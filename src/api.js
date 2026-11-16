/**
 * Capa de envío y respaldo local.
 *
 * Modos:
 *  - remoto: existe /api/encuesta (Vercel) → Postgres vía Supabase.
 *  - local:  no hay backend (ej. GitHub Pages) → cola en localStorage + export.
 *
 * La app funciona igual en ambos. El panel (?panel=1) muestra el modo y exporta.
 */

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const BACKEND = import.meta.env.VITE_BACKEND || 'auto';
const K_COLA = 'ru_cola';
const K_DATOS = 'ru_respuestas';
const K_MODO = 'ru_modo';

let modoRemoto = null;

export function apiUrl(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

function leerJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function escribirJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* cuota llena: se ignora, la sesión sigue funcionando */
  }
}

async function conTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function detectarModo(force = false) {
  if (modoRemoto !== null && !force) return modoRemoto;

  if (BACKEND === 'none') {
    modoRemoto = false;
    escribirJSON(K_MODO, false);
    document.dispatchEvent(new CustomEvent('modo-datos', { detail: 'local' }));
    return false;
  }

  try {
    const r = await conTimeout(
      apiUrl('/api/encuesta'),
      { method: 'GET', headers: { Accept: 'application/json' } },
      2500
    );
    const body = await r.json();
    modoRemoto = Boolean(r.ok && body?.ok === true);
  } catch {
    modoRemoto = false;
  }
  escribirJSON(K_MODO, modoRemoto);
  document.dispatchEvent(
    new CustomEvent('modo-datos', { detail: modoRemoto ? 'remoto' : 'local' })
  );
  return modoRemoto;
}

export function getModo() {
  if (modoRemoto === null) return localStorage.getItem(K_MODO) === 'true' ? 'remoto' : 'local';
  return modoRemoto ? 'remoto' : 'local';
}

/* ---------------- cola de pendientes ---------------- */

export function leerCola() {
  return leerJSON(K_COLA, []);
}

function guardarCola(cola) {
  escribirJSON(K_COLA, cola.slice(-300));
}

function encolar(payload) {
  const cola = leerCola();
  if (cola.some((p) => p.idempotency_key === payload.idempotency_key)) return;
  cola.push(payload);
  guardarCola(cola);
}

export function pendientes() {
  return leerCola().length;
}

/* ---------------- copia local de todas las respuestas ---------------- */

function guardarCopia(payload) {
  const datos = leerJSON(K_DATOS, []);
  const i = datos.findIndex((d) => d.idempotency_key === payload.idempotency_key);
  if (i >= 0) datos[i] = payload;
  else datos.push(payload);
  escribirJSON(K_DATOS, datos.slice(-2000));
}

export function totalLocal() {
  return leerJSON(K_DATOS, []).length;
}

/* ---------------- envío ---------------- */

export async function enviarEncuesta(payload) {
  guardarCopia(payload);

  const remoto = await detectarModo();
  if (!remoto) {
    encolar(payload);
    return { ok: false, local: true };
  }

  try {
    const r = await conTimeout(
      apiUrl('/api/encuesta'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': payload.idempotency_key,
        },
        body: JSON.stringify(payload),
      },
      9000
    );

    if (r.ok || r.status === 409) return { ok: true };

    const body = await r.json().catch(() => ({}));
    encolar(payload);
    return { ok: false, local: true, codigo: body?.error || r.status };
  } catch {
    encolar(payload);
    return { ok: false, local: true };
  }
}

export async function enviarEventos(eventos) {
  if (!eventos?.length) return false;
  if (!(await detectarModo())) return false;
  try {
    const r = await conTimeout(
      apiUrl('/api/evento'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventos }),
      },
      5000
    );
    return r.ok;
  } catch {
    return false;
  }
}

/** Reintenta la cola de pendientes (máx. 25 por intento). */
export async function sincronizar() {
  const remoto = await detectarModo(true);
  if (!remoto) return { ok: false, enviados: 0, motivo: 'sin-backend' };

  const cola = leerCola();
  if (!cola.length) return { ok: true, enviados: 0 };

  let enviados = 0;
  const restantes = [...cola];

  for (const payload of cola.slice(0, 25)) {
    try {
      const r = await conTimeout(
        apiUrl('/api/encuesta'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': payload.idempotency_key,
          },
          body: JSON.stringify(payload),
        },
        7000
      );
      if (r.ok || r.status === 409) {
        enviados++;
        restantes.splice(restantes.indexOf(payload), 1);
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  guardarCola(restantes);
  return { ok: true, enviados };
}

/* ---------------- export ---------------- */

function csvCampo(v) {
  const s = v == null ? '' : String(v);
  return `"${s.replaceAll('"', '""').replace(/\r?\n/g, ' ')}"`;
}

export function construirCSV() {
  const datos = leerJSON(K_DATOS, []);
  const cols = [
    'fecha_iso',
    'idempotency_key',
    'sesion_id',
    'perfil',
    'conocia_codigo',
    'utilidad',
    'duracion_ms',
    'origen',
    'enviado',
  ];

  const filas = datos.map((d) =>
    [
      d.creado_en || '',
      d.idempotency_key || '',
      d.sesion_id || '',
      d.perfil || '',
      d.respuestas?.conocia_codigo || '',
      d.respuestas?.utilidad ?? '',
      d.meta?.duracion_ms ?? '',
      d.meta?.origen || '',
      d.enviado ? 'si' : 'no',
    ]
      .map(csvCampo)
      .join(',')
  );

  return [cols.join(','), ...filas].join('\r\n');
}

export function descargar(nombre, contenido, tipo = 'text/plain;charset=utf-8') {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportarJSON() {
  const datos = leerJSON(K_DATOS, []);
  descargar(
    `residuos-uch-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(datos, null, 2),
    'application/json'
  );
  return datos.length;
}

export function exportarCSV() {
  const csv = construirCSV();
  descargar(
    `residuos-uch-${new Date().toISOString().slice(0, 10)}.csv`,
    `\uFEFF${csv}`,
    'text/csv;charset=utf-8'
  );
  return csv.split('\r\n').length - 1;
}

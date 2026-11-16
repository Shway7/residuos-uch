/**
 * POST /api/encuesta — recibe una respuesta, valida y guarda.
 * GET  /api/encuesta — health check que usa el frontend para detectar el modo.
 *
 * Persistencia: Supabase (Postgres) vía REST, con service_role.
 * Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IP_SALT (opcional).
 *
 * Sin variables responde 503 y el cliente guarda en local. Nunca se pierde nada
 * en silencio: el frontend muestra "Guardado en este dispositivo".
 */

import crypto from 'node:crypto';
import { PERFILES, SURVEY_VERSION } from '../shared/datos.js';

const PERFIL_OK = new Set(PERFILES.map((p) => p.id));
const CONOCIA_OK = new Set(['si', 'mas_o_menos', 'no']);
const MAX_BODY = 16 * 1024;

/* Rate limit en memoria: por instancia, suficiente para una campaña de 150. */
const hits = new Map();

function limitado(hash) {
  if (!hash) return false;
  const ahora = Date.now();
  const ventana = 10 * 60 * 1000;
  const previos = (hits.get(hash) || []).filter((t) => ahora - t < ventana);
  if (previos.length >= 8) {
    hits.set(hash, previos);
    return true;
  }
  previos.push(ahora);
  hits.set(hash, previos);
  if (hits.size > 4000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => ahora - t < ventana)) hits.delete(k);
    }
  }
  return false;
}

function cors(req, res) {
  const permitido = process.env.ALLOWED_ORIGIN || '';
  const origen = req.headers.origin;
  if (!permitido || !origen) return;
  if (permitido === '*' || permitido === origen) {
    res.setHeader('Access-Control-Allow-Origin', permitido === '*' ? '*' : origen);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
}

function texto(valor, max) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}

function validar(body) {
  const errores = {};

  if (!body || typeof body !== 'object') return { errores: { body: 'inválido' } };

  const perfil = texto(body.perfil, 40);
  if (!PERFIL_OK.has(perfil)) errores.perfil = 'no permitido';

  const idem = texto(body.idempotency_key, 80);
  if (idem.length < 8) errores.idempotency_key = 'requerido';

  const sesion = texto(body.sesion_id, 80);
  if (sesion.length < 8) errores.sesion_id = 'requerido';

  const respuestas =
    body.respuestas && typeof body.respuestas === 'object' ? body.respuestas : {};

  const conocia = texto(respuestas.conocia_codigo, 20);
  if (!CONOCIA_OK.has(conocia)) errores.conocia_codigo = 'no permitido';

  const utilidad = respuestas.utilidad;
  if (!Number.isInteger(utilidad) || utilidad < 1 || utilidad > 5) {
    errores.utilidad = 'debe ser un entero 1..5';
  }

  const duracion = Number(body.meta?.duracion_ms);
  if (Number.isFinite(duracion) && (duracion < 0 || duracion > 3_600_000)) {
    errores.duracion_ms = 'fuera de rango';
  }

  return {
    errores: Object.keys(errores).length ? errores : null,
    fila: {
      idempotency_key: idem,
      sesion_id: sesion,
      survey_version: texto(body.survey_version, 20) || SURVEY_VERSION,
      perfil,
      conocia_codigo: conocia,
      utilidad: Number.isInteger(utilidad) ? utilidad : null,
      duracion_ms: Number.isFinite(duracion) ? Math.round(duracion) : null,
      origen: texto(body.meta?.origen, 20) || 'directo',
    },
  };
}

async function insertar(fila, ipHash, userAgent) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return { ok: false, codigo: 'SIN_BASE_DE_DATOS' };

  const row = { ...fila, ip_hash: ipHash, user_agent: userAgent.slice(0, 300) };

  try {
    const r = await fetch(`${url}/rest/v1/respuestas`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });

    if (r.status === 409) return { ok: true, duplicado: true };
    if (!r.ok) {
      console.error('supabase_insert', r.status, (await r.text()).slice(0, 300));
      return { ok: false, codigo: 'DB_ERROR' };
    }
    return { ok: true };
  } catch (err) {
    console.error('supabase_error', err?.message);
    return { ok: false, codigo: 'DB_ERROR' };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  cors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      version: SURVEY_VERSION,
      db: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  let body = req.body;
  try {
    if (typeof body === 'string') {
      if (body.length > MAX_BODY) return res.status(413).json({ error: 'BODY_TOO_LARGE' });
      body = JSON.parse(body);
    }
  } catch {
    return res.status(400).json({ error: 'JSON_INVALIDO' });
  }

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'BODY_VACIO' });
  }

  const { errores, fila } = validar(body);
  if (errores) {
    return res.status(400).json({ error: 'VALIDACION', campos: errores });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '0.0.0.0';
  const ipHash = crypto
    .createHash('sha256')
    .update(`${ip}:${process.env.IP_SALT || 'residuos-uch'}`)
    .digest('hex')
    .slice(0, 32);

  if (limitado(ipHash)) {
    return res.status(429).json({ error: 'RATE_LIMITED' });
  }

  const guardado = await insertar(fila, ipHash, String(req.headers['user-agent'] || ''));

  if (!guardado.ok) {
    return res.status(503).json({ error: guardado.codigo });
  }

  return res.status(guardado.duplicado ? 200 : 201).json({
    ok: true,
    duplicado: Boolean(guardado.duplicado),
  });
}

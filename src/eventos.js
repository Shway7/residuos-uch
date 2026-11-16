/** Sesión anónima y eventos de uso (embudo propio, sin cookies de terceros). */

import { enviarEventos } from './api.js';

const K_SESION = 'ru_sesion';
const K_EVENTOS = 'ru_eventos';
const MAX = 600;

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const sesionId = (() => {
  try {
    const guardado = localStorage.getItem(K_SESION);
    if (guardado) return guardado;
    const nuevo = uuid();
    localStorage.setItem(K_SESION, nuevo);
    return nuevo;
  } catch {
    return uuid();
  }
})();

function leer() {
  try {
    return JSON.parse(localStorage.getItem(K_EVENTOS) || '[]');
  } catch {
    return [];
  }
}

function guardar(cola) {
  try {
    localStorage.setItem(K_EVENTOS, JSON.stringify(cola.slice(-MAX)));
  } catch {
    /* sin espacio: se descarta el histórico, no rompe la app */
  }
}

let cola = leer();
let timer = null;
let enviando = false;

function programar() {
  clearTimeout(timer);
  timer = setTimeout(() => flushEventos(), 3500);
}

export function track(tipo, meta = {}) {
  cola.push({ tipo, meta, ts: Date.now(), sesion_id: sesionId });
  guardar(cola);
  if (tipo !== 'view') programar();
}

export async function flushEventos() {
  if (enviando || !cola.length) return;
  enviando = true;
  const lote = cola.slice(0, 80);
  const ok = await enviarEventos(lote);
  if (ok) {
    const ids = new Set(lote.map((e) => `${e.ts}-${e.tipo}`));
    cola = cola.filter((e) => !ids.has(`${e.ts}-${e.tipo}`));
    guardar(cola);
  }
  enviando = false;
}

/** Envío final al cerrar la pestaña (no bloquea la navegación). */
export function flushAlSalir() {
  if (!cola.length) return;
  try {
    if (localStorage.getItem('ru_modo') !== 'true') return;
    const url = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '') + '/api/evento';
    const blob = new Blob([JSON.stringify({ eventos: cola.slice(0, 80) })], {
      type: 'application/json',
    });
    navigator.sendBeacon?.(url, blob);
  } catch {
    /* noop */
  }
}

export function eventosLocales() {
  return cola.length;
}

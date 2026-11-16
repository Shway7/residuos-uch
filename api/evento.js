/**
 * POST /api/evento — lote de eventos de uso (embudo).
 * Si no hay base configurada responde 204: los eventos son opcionales,
 * nunca deben romper la experiencia.
 */

const TIPOS = new Set([
  'view',
  'scroll_half',
  'tap_tacho',
  'tap_como_llegar',
  'ver_mapa',
  'open_encuesta',
  'submit_encuesta',
  'geo',
]);

const MAX_EVENTOS = 60;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  let body = req.body;
  try {
    if (typeof body === 'string') body = JSON.parse(body);
  } catch {
    return res.status(400).json({ error: 'JSON_INVALIDO' });
  }

  const eventos = Array.isArray(body?.eventos) ? body.eventos.slice(0, MAX_EVENTOS) : [];
  if (!eventos.length) return res.status(204).end();

  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return res.status(204).end();

  const filas = eventos
    .filter((e) => e && TIPOS.has(e.tipo))
    .map((e) => ({
      sesion_id: String(e.sesion_id || '').slice(0, 80),
      tipo: e.tipo,
      punto_id: typeof e.meta?.punto === 'string' ? e.meta.punto.slice(0, 60) : null,
      meta: e.meta && typeof e.meta === 'object' ? e.meta : {},
    }))
    .filter((f) => f.sesion_id);

  if (!filas.length) return res.status(204).end();

  try {
    const r = await fetch(`${url}/rest/v1/eventos`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(filas),
    });
    if (!r.ok) console.error('supabase_eventos', r.status);
  } catch (err) {
    console.error('supabase_eventos_error', err?.message);
  }

  return res.status(204).end();
}

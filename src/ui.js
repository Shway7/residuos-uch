/** Utilidades de UI compartidas. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Ilustración vectorial de un tacho. */
export function binSVG(color, label = '') {
  return `<svg viewBox="0 0 100 124" role="img" aria-hidden="true" focusable="false">
    <rect x="41" y="5" width="18" height="9" rx="4.5" fill="${color}"/>
    <rect x="8" y="16" width="84" height="15" rx="7" fill="${color}"/>
    <path d="M16.5 34h67l-6.3 76.4a9.2 9.2 0 0 1-9.2 8.6H32a9.2 9.2 0 0 1-9.2-8.6L16.5 34Z" fill="${color}"/>
    <path d="M27 41h8l-4.2 69h-7.4L27 41Z" fill="#fff" opacity=".14"/>
    <rect x="26" y="54" width="48" height="32" rx="9" fill="#fff" opacity=".95"/>
    <text x="50" y="74.5" text-anchor="middle" font-size="10.5" font-weight="800"
      letter-spacing=".4" fill="${color}" font-family="system-ui, sans-serif">${label}</text>
  </svg>`;
}

let toastTimer;

export function toast(msg, ms = 2800) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), ms);
}

export function fmtDist(metros) {
  if (metros == null || !Number.isFinite(metros)) return '';
  if (metros < 1000) return `${Math.round(metros / 10) * 10} m`;
  return `${(metros / 1000).toFixed(1)} km`;
}

export function mapsUrl(punto) {
  return `https://www.google.com/maps/dir/?api=1&destination=${punto.lat},${punto.lng}&travelmode=walking`;
}

export function distanciaKm(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

import './estilos.css';
import { TACHOS } from '../shared/datos.js';
import { initEncuesta } from './encuesta.js';
import { initMapa } from './mapa.js';
import {
  detectarModo,
  exportarCSV,
  exportarJSON,
  getModo,
  pendientes,
  sincronizar,
  totalLocal,
} from './api.js';
import { track, flushAlSalir } from './eventos.js';
import { binSVG, toast } from './ui.js';

/* ---------- tachos interactivos ---------- */

function initTachos() {
  const cont = document.getElementById('hero-bins');
  const info = document.getElementById('bin-info');
  if (!cont || !info) return;

  cont.innerHTML = TACHOS.map(
    (t) => `
    <button class="hero-bin" type="button" data-tacho="${t.id}" style="--c:${t.color}"
      aria-pressed="false" aria-label="${t.nombre}: ${t.detalle}. ${t.ejemplos}">
      ${binSVG(t.color, t.nombre.toUpperCase())}
      <span class="hero-bin-name">${t.nombre}</span>
    </button>`
  ).join('');

  cont.addEventListener('click', (e) => {
    const btn = e.target.closest('.hero-bin');
    if (!btn) return;

    const t = TACHOS.find((x) => x.id === btn.dataset.tacho);
    if (!t) return;

    cont
      .querySelectorAll('.hero-bin')
      .forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));

    info.innerHTML = `
      <span class="bin-info-dot" style="background:${t.color}"></span>
      <span><b>${t.nombre} · ${t.detalle}</b><br>${t.ejemplos}</span>`;

    track('tap_tacho', { tacho: t.id });
  });
}

/* ---------- topbar ---------- */

function initTopbar() {
  const bar = document.getElementById('topbar');
  if (!bar) return;

  const actualizar = () => bar.classList.toggle('is-stuck', window.scrollY > 24);
  actualizar();
  window.addEventListener('scroll', actualizar, { passive: true });
}

/* ---------- privacidad ---------- */

function initPrivacidad() {
  const dlg = document.getElementById('privacidad');
  if (!dlg) return;

  const abrir = () => dlg.showModal();

  document.getElementById('privacidad-btn')?.addEventListener('click', abrir);
  document.getElementById('privacidad-btn-2')?.addEventListener('click', abrir);

  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });

  dlg.querySelector('[data-close]')?.addEventListener('click', () => dlg.close());
}

/* ---------- panel de campo (?panel=1) ---------- */

function initPanel() {
  if (!new URLSearchParams(location.search).has('panel')) return;

  const panel = document.getElementById('panel');
  const meta = document.getElementById('panel-meta');
  if (!panel || !meta) return;

  panel.hidden = false;

  const refrescar = () => {
    const n = totalLocal();
    meta.textContent = `${n} ${n === 1 ? 'respuesta' : 'respuestas'} · ${pendientes()} pendientes · modo: ${getModo()}`;
  };

  refrescar();
  document.addEventListener('modo-datos', refrescar);

  document.getElementById('panel-close')?.addEventListener('click', () => {
    panel.hidden = true;
  });

  document.getElementById('panel-csv')?.addEventListener('click', () => {
    const n = exportarCSV();
    toast(`${n} respuestas exportadas`);
  });

  document.getElementById('panel-json')?.addEventListener('click', () => {
    const n = exportarJSON();
    toast(`${n} respuestas exportadas`);
  });

  document.getElementById('panel-sync')?.addEventListener('click', async () => {
    toast('Sincronizando…');
    const r = await sincronizar();
    refrescar();
    if (!r.ok) toast('Sin backend: los datos están en este dispositivo', 3600);
    else toast(r.enviados ? `${r.enviados} enviadas` : 'No había pendientes');
  });
}

/* ---------- arranque ---------- */

function main() {
  initTachos();
  initTopbar();
  initPrivacidad();
  initPanel();

  const dialog = document.getElementById('encuesta-dialog');
  const cta = document.getElementById('sticky-cta');

  const encuesta = initEncuesta({
    dialog,
    onDone: () => actualizarCta(),
  });

  function actualizarCta() {
    if (!cta) return;
    if (encuesta.enviada || dialog?.open) {
      cta.hidden = true;
      return;
    }
    cta.hidden = window.scrollY < window.innerHeight * 0.55;
  }

  document
    .querySelectorAll('[data-abrir-encuesta]')
    .forEach((b) => b.addEventListener('click', () => encuesta.abrir()));

  actualizarCta();
  window.addEventListener('scroll', actualizarCta, { passive: true });
  dialog?.addEventListener('close', actualizarCta);

  initMapa();

  track('view', {
    ruta: location.pathname,
    ref: document.referrer || null,
    qr: new URLSearchParams(location.search).has('qr'),
  });

  detectarModo();

  let medio = false;
  window.addEventListener(
    'scroll',
    () => {
      if (medio) return;
      const h = document.documentElement;
      const pct = (h.scrollTop + h.clientHeight) / h.scrollHeight;
      if (pct >= 0.5) {
        medio = true;
        track('scroll_half', {});
      }
    },
    { passive: true }
  );

  window.addEventListener('pagehide', flushAlSalir);
}

main();

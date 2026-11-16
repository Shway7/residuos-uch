/** Encuesta anónima de 3 toques, dentro de un modal. */

import { SURVEY_VERSION } from '../shared/datos.js';
import { enviarEncuesta } from './api.js';
import { sesionId, track } from './eventos.js';
import { toast } from './ui.js';

const ETIQUETAS = ['', 'Nada útil', 'Poco útil', 'Normal', 'Útil', 'Muy útil'];

function nuevoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function initEncuesta({ dialog, onDone } = {}) {
  if (!dialog) return { abrir() {}, enviada: false };

  const form = dialog.querySelector('#enc-form');
  const gracias = dialog.querySelector('#enc-gracias');
  const submit = dialog.querySelector('#enc-submit');
  const starLabel = dialog.querySelector('#star-label');
  const titulo = dialog.querySelector('.enc-head h2');

  const respuesta = { perfil: null, conocia_codigo: null, utilidad: null };
  let inicio = 0;
  let enviando = false;
  let enviada = false;

  function listo() {
    return Boolean(
      respuesta.perfil && respuesta.conocia_codigo && respuesta.utilidad
    );
  }

  function refrescar() {
    submit.disabled = !listo() || enviando;
    submit.textContent = enviando
      ? 'Enviando…'
      : listo()
        ? 'Enviar respuestas'
        : 'Responde las 3';
  }

  dialog.querySelectorAll('.chips').forEach((grupo) => {
    grupo.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip-btn');
      if (!btn) return;

      grupo.querySelectorAll('.chip-btn').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      });

      respuesta[grupo.dataset.campo] = btn.dataset.v;
      refrescar();
    });
  });

  const estrellas = [...dialog.querySelectorAll('.star')];

  const pintarEstrellas = (n) => {
    estrellas.forEach((s, i) => {
      const on = i < n;
      s.classList.toggle('is-on', on);
      s.setAttribute('aria-pressed', String(on));
    });
  };

  estrellas.forEach((star) => {
    star.addEventListener('click', () => {
      const n = Number(star.dataset.v);
      respuesta.utilidad = n;
      pintarEstrellas(n);
      starLabel.textContent = ETIQUETAS[n];
      refrescar();
    });

    star.addEventListener('mouseenter', () => {
      starLabel.textContent = ETIQUETAS[Number(star.dataset.v)];
    });
  });

  dialog.querySelector('.stars')?.addEventListener('mouseleave', () => {
    starLabel.textContent = respuesta.utilidad
      ? ETIQUETAS[respuesta.utilidad]
      : '\u00a0';
  });

  async function enviar(e) {
    e.preventDefault();
    if (enviando || !listo()) return;

    enviando = true;
    refrescar();

    const payload = {
      idempotency_key: nuevoId(),
      survey_version: SURVEY_VERSION,
      sesion_id: sesionId,
      perfil: respuesta.perfil,
      respuestas: {
        conocia_codigo: respuesta.conocia_codigo,
        utilidad: respuesta.utilidad,
      },
      meta: {
        duracion_ms: Math.max(0, Date.now() - inicio),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        idioma: navigator.language || 'es-PE',
        origen: new URLSearchParams(location.search).has('qr') ? 'qr' : 'directo',
        referrer: document.referrer || null,
      },
      creado_en: new Date().toISOString(),
    };

    track('submit_encuesta', {
      perfil: payload.perfil,
      utilidad: payload.respuestas.utilidad,
    });

    const res = await enviarEncuesta(payload);

    enviando = false;
    enviada = true;

    form.hidden = true;
    gracias.hidden = false;
    if (titulo) titulo.textContent = 'Listo';

    if (res.local) toast('Guardado en este dispositivo');

    onDone?.({ ...res, payload });
  }

  form?.addEventListener('submit', enviar);

  dialog.querySelectorAll('[data-cerrar-encuesta]').forEach((b) => {
    b.addEventListener('click', () => dialog.close());
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  refrescar();

  return {
    abrir() {
      if (!enviada) {
        inicio = Date.now();
        track('open_encuesta', {});
      }
      dialog.showModal();
      if (!enviada) {
        setTimeout(() => {
          dialog.querySelector('.chip-btn')?.focus({ preventScroll: true });
        }, 60);
      }
    },
    get enviada() {
      return enviada;
    },
  };
}

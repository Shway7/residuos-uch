import 'leaflet/dist/leaflet.css';
import { PUNTOS } from '../shared/datos.js';
import { track } from './eventos.js';
import { distanciaKm, fmtDist, mapsUrl, toast } from './ui.js';

let mapa = null;
let L = null;
let Lprom = null;
let origen = null;
let marcadorUsuario = null;

const elLista = () => document.getElementById('lista-puntos');
const elMapa = () => document.getElementById('mapa');

async function cargarLeaflet() {
  if (!Lprom) Lprom = import('leaflet').then((m) => m.default ?? m);
  L = await Lprom;
  return L;
}

function puntosConDistancia() {
  return PUNTOS.map((p, i) => ({
    ...p,
    n: i + 1,
    distancia: origen ? distanciaKm(origen, p) : null,
  })).sort((a, b) => {
    if (a.distancia == null) return 0;
    return a.distancia - b.distancia;
  });
}

function tarjeta(p) {
  const dist =
    p.distancia == null
      ? ''
      : ` · <b class="punto-dist">${fmtDist(p.distancia * 1000)}</b>`;

  return `
    <article class="punto-card">
      <span class="punto-n" aria-hidden="true">${p.n}</span>
      <div class="punto-main">
        <p class="punto-name">${p.nombre}</p>
        <p class="punto-ref">${p.ref}${dist}</p>
      </div>
      <a class="punto-go" href="${mapsUrl(p)}" target="_blank" rel="noopener"
        data-punto="${p.id}" aria-label="Cómo llegar a ${p.nombre} en Google Maps">
        Ruta <span aria-hidden="true">↗</span>
      </a>
    </article>`;
}

function renderLista() {
  const cont = elLista();
  if (!cont) return;
  cont.innerHTML = puntosConDistancia().map(tarjeta).join('');
}

function popup(p) {
  return `<b>${p.nombre}</b>${p.ref}
    <br><a href="${mapsUrl(p)}" target="_blank" rel="noopener" data-popup="${p.id}">Cómo llegar ↗</a>`;
}

function pinIcon(p) {
  return L.divIcon({
    className: 'pin-wrap',
    html: `<span class="pin"><span>${p.n}</span></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -13],
  });
}

function pintarUsuario() {
  if (!mapa || !L || !origen) return;
  if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
  marcadorUsuario = L.marker([origen.lat, origen.lng], {
    icon: L.divIcon({
      className: 'pin-wrap',
      html: '<span class="pin pin--user"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    }),
    zIndexOffset: 1000,
    interactive: false,
  }).addTo(mapa);
}

async function abrirMapa() {
  const el = elMapa();
  if (!el) return;

  if (!mapa) {
    await cargarLeaflet();
    mapa = L.map(el, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    }).setView([-11.9913, -77.0713], 17);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(mapa);

    PUNTOS.forEach((p, i) => {
      const marker = L.marker([p.lat, p.lng], {
        icon: pinIcon({ ...p, n: i + 1 }),
        title: p.nombre,
      }).addTo(mapa);

      marker.bindPopup(popup(p), { closeButton: true });
      marker.on('popupopen', (e) => {
        e.popup
          .getElement()
          ?.querySelector('a')
          ?.addEventListener('click', () => track('tap_como_llegar', { punto: p.id, desde: 'mapa' }));
      });
    });

    pintarUsuario();
  }

  requestAnimationFrame(() => mapa?.invalidateSize());
  track('ver_mapa', { puntos: PUNTOS.length });
}

function ubicarme(btn) {
  if (!navigator.geolocation) {
    toast('Tu navegador no permite obtener la ubicación');
    return;
  }

  const textoOriginal = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Ubicando…';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      origen = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      renderLista();
      pintarUsuario();
      mapa?.setView([origen.lat, origen.lng], 18);
      btn.disabled = false;
      btn.innerHTML = textoOriginal;
      toast('Listo: puntos ordenados por distancia');
      track('geo', { precision: Math.round(pos.coords.accuracy || 0) });
    },
    () => {
      btn.disabled = false;
      btn.innerHTML = textoOriginal;
      toast('No pudimos obtener tu ubicación. Revisa los permisos.');
    },
    { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
  );
}

export function initMapa() {
  renderLista();

  const cont = elLista();
  cont?.addEventListener('click', (e) => {
    const a = e.target.closest('.punto-go');
    if (a) track('tap_como_llegar', { punto: a.dataset.punto, desde: 'lista' });
  });

  const tabLista = document.getElementById('tab-lista');
  const tabMapa = document.getElementById('tab-mapa');

  function setVista(vista) {
    const esMapa = vista === 'mapa';

    tabLista?.classList.toggle('is-active', !esMapa);
    tabLista?.setAttribute('aria-selected', String(!esMapa));
    tabMapa?.classList.toggle('is-active', esMapa);
    tabMapa?.setAttribute('aria-selected', String(esMapa));

    if (cont) cont.hidden = esMapa;
    const m = elMapa();
    if (m) m.hidden = !esMapa;
    if (esMapa) abrirMapa();
  }

  tabLista?.addEventListener('click', () => setVista('lista'));
  tabMapa?.addEventListener('click', () => setVista('mapa'));

  document.getElementById('geo-btn')?.addEventListener('click', (e) => {
    ubicarme(e.currentTarget);
  });
}

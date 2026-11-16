/**
 * Fuente única de datos del proyecto.
 * La usa el frontend (Vite) y la función serverless (api/).
 *
 * Código de colores: NTP 900.058:2019, Tabla 1 — ámbito municipal.
 * Si el campus adopta otra codificación, se cambia SOLO aquí.
 */

export const SURVEY_VERSION = 'v2';

export const TACHOS = [
  {
    id: 'verde',
    nombre: 'Verde',
    detalle: 'Aprovechables',
    ejemplos: 'Papel, cartón, vidrio, plástico y latas. Limpios y secos.',
    color: '#17a45a',
  },
  {
    id: 'marron',
    nombre: 'Marrón',
    detalle: 'Orgánicos',
    ejemplos: 'Restos de comida, cáscaras, café y poda.',
    color: '#8a5a34',
  },
  {
    id: 'negro',
    nombre: 'Negro',
    detalle: 'No aprovechables',
    ejemplos: 'Pañales, colillas, tecnopor y papel sucio.',
    color: '#2a2a2a',
  },
  {
    id: 'rojo',
    nombre: 'Rojo',
    detalle: 'Peligrosos',
    ejemplos: 'Pilas, medicinas vencidas, lámparas y envases con químicos.',
    color: '#d93a3a',
  },
];

export const PERFILES = [
  { id: 'estudiante_uch', label: 'Estudiante UCH', emoji: '🎓' },
  { id: 'docente', label: 'Docente', emoji: '📚' },
  { id: 'administrativo', label: 'Administrativo', emoji: '🗂️' },
  { id: 'vecino', label: 'Vecino de Los Olivos', emoji: '🏘️' },
  { id: 'transito', label: 'Transeúnte', emoji: '🚶' },
];

/**
 * Puntos de acopio.
 * ⚠️ Coordenadas de referencia: reemplazar por las definitivas (GPS tomado en campo).
 * Para añadir o mover un punto basta editar este array.
 */
export const PUNTOS = [
  {
    id: 'ingreso',
    nombre: 'Ingreso principal',
    ref: 'Av. Universitaria Norte 5175',
    lat: -11.99062,
    lng: -77.07148,
    tachos: ['verde', 'marron', 'negro', 'rojo'],
  },
  {
    id: 'pabellon-a',
    nombre: 'Pabellón A',
    ref: 'Patio central, junto a las escaleras',
    lat: -11.99128,
    lng: -77.07105,
    tachos: ['verde', 'marron', 'negro', 'rojo'],
  },
  {
    id: 'pabellon-b',
    nombre: 'Pabellón B',
    ref: 'Pasillo de aulas, primer piso',
    lat: -11.99172,
    lng: -77.07176,
    tachos: ['verde', 'marron', 'negro', 'rojo'],
  },
  {
    id: 'biblioteca',
    nombre: 'Biblioteca',
    ref: 'Hall de ingreso',
    lat: -11.99102,
    lng: -77.07218,
    tachos: ['verde', 'marron', 'negro', 'rojo'],
  },
  {
    id: 'cafeteria',
    nombre: 'Cafetería',
    ref: 'Zona de mesas, lado derecho',
    lat: -11.99158,
    lng: -77.07095,
    tachos: ['verde', 'marron', 'negro', 'rojo'],
  },
  {
    id: 'explanada',
    nombre: 'Explanada deportiva',
    ref: 'Borde de la losa',
    lat: -11.99218,
    lng: -77.07152,
    tachos: ['verde', 'marron', 'negro', 'rojo'],
  },
  {
    id: 'exterior',
    nombre: 'Av. Universitaria (exterior)',
    ref: 'Frontis del campus, vereda',
    lat: -11.99078,
    lng: -77.07048,
    tachos: ['verde', 'marron', 'negro', 'rojo'],
  },
];

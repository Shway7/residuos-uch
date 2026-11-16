# Residuos UCH — Los Olivos

Landing interactiva de la campaña de segregación en la fuente. Una sola página, dos scrolls:

1. **Hero** — los 4 tachos del código NTP 900.058:2019 son botones: al tocarlos muestran qué va dentro. Incluye las 3R y el dato 78 % / 3 %.
2. **Puntos de acopio** — lista compacta de los 7 módulos con ruta a Google Maps, más mapa Leaflet y geolocalización opcional.

La **encuesta anónima de 3 preguntas** vive en un modal: se abre desde el botón del hero, la barra superior, el pie o el CTA flotante.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/
npm run preview
```

Stack: Vite + JavaScript vanilla + CSS propio. Leaflet se carga solo al abrir el mapa (~43 KB gzip extra; la carga inicial ronda 23 KB gzip).

## Editar contenido

| Qué | Dónde |
| --- | --- |
| Colores y textos de los tachos | `shared/datos.js` → `TACHOS` |
| Perfiles de la encuesta | `shared/datos.js` → `PERFILES` |
| Los 7 puntos (nombre, referencia, lat/lng) | `shared/datos.js` → `PUNTOS` |
| Preguntas del modal | `index.html` → `#encuesta-dialog` |
| Estilos | `src/estilos.css` |

Las coordenadas actuales son **de referencia** alrededor del campus (`-11.9913, -77.0713`). Cuando se instalen los módulos definitivos basta reemplazar `lat`/`lng` en `PUNTOS`.

## Encuesta: modos de datos

- **Local (por defecto en GitHub Pages).** Sin backend, las respuestas se guardan en `localStorage` y se exportan a CSV/JSON desde `?panel=1`. Es el modo que usa el build con `VITE_BACKEND=none`.
- **Remoto (Vercel + Supabase).** El frontend detecta `/api/encuesta`; la función valida y escribe en Postgres con `service_role`.

Para activar el modo remoto:

1. Crear un proyecto en Supabase y ejecutar `db/schema.sql` en el SQL Editor.
2. Desplegar en Vercel con `vercel --prod`.
3. Definir variables de entorno:

```
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role>
IP_SALT=<cadena aleatoria>
ALLOWED_ORIGIN=https://<tu-dominio>
```

4. Reconstruir el frontend **sin** `VITE_BACKEND=none` (o con `VITE_BACKEND=auto`) y `VITE_API_BASE` si la API vive en otro dominio.

Sin esas variables la app sigue funcionando y avisa “Guardado en este dispositivo”.

## Privacidad

No se piden nombre, DNI, teléfono ni correo. Se guarda un identificador aleatorio de sesión para no duplicar respuestas y se presenta todo agregado. Base legal: Ley N.º 29733 (Perú). El detalle está en el modal de privacidad del sitio.

## Deploy

GitHub Pages se publica automáticamente con `.github/workflows/pages.yml` en cada push a `main` (build con `VITE_BACKEND=none`). El `base: './'` de Vite permite servir el sitio tanto en la raíz como en un subdirectorio.

También hay `vercel.json` listo para el despliegue con backend.

## Estructura

```
index.html            hero, puntos, modales
src/main.js           arranque e interacciones
src/encuesta.js       modal de 3 preguntas
src/mapa.js           Leaflet bajo demanda + lista
src/api.js            envío, cola local y export
src/eventos.js        sesión anónima y embudo
src/ui.js             SVG de tachos y utilidades
src/estilos.css       sistema visual
shared/datos.js       tachos, perfiles y puntos
api/                  funciones serverless (Vercel)
db/schema.sql         tablas y vistas en Supabase
```

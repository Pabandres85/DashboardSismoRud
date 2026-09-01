# Dashboard interno RUD · Cali y Valle del Cauca

Dashboard estático en HTML, CSS y JavaScript para analizar el RUD, las autoevaluaciones, las visitas y los reportes ciudadanos del sismo. Cali es la vista principal; el Valle del Cauca queda disponible como comparación departamental.

## Incluye

- Cali como vista inicial con tres modos: RUD, RUD + autoevaluaciones/visitas y ciudadanos vs RUD.
- Perfil social de Cali: género, edad, etnia, parentesco y población prioritaria.
- Bienes y afectación de Cali: estado, tenencia, tipo de bien y daño estructural.
- Filtros de alcance (zona urbana/rural y barrio/vereda) que reindexan KPIs, gráficos y tablas.
- Filtros de capa del mapa (nivel de daño y búsqueda de dirección) que solo afectan a los puntos.
- Mapa Leaflet con direcciones de referencia, puntos consolidados y conteos agregados.
- Comparación departamental del Valle por municipio.
- Calidad de datos, cobertura, reglas de cruce y trazabilidad.

## Estructura

```
.
├── index.html                  Única página; contiene las tres secciones
├── assets/
│   ├── css/
│   │   ├── base.css            Tokens de diseño, reset y tipografía
│   │   ├── layout.css          Shell, barra lateral, cabecera, rejillas
│   │   ├── components.css      KPIs, paneles, filtros, tablas, píldoras
│   │   ├── map.css             Panel de mapa y ajustes de Leaflet
│   │   └── responsive.css      Media queries (se carga en último lugar)
│   └── js/
│       ├── core/
│       │   ├── config.js       Rutas, paletas y etiquetas compartidas
│       │   ├── utils.js        Helpers de DOM, formato y escape
│       │   ├── charts.js       Registro Chart.js + donut/bars/draw
│       │   └── filters.js      Estado de los controles de Cali
│       ├── sections/
│       │   ├── cali-map.js     Capa Leaflet de puntos consolidados
│       │   ├── cali.js         Sección 01 · Cali principal
│       │   ├── valle.js        Sección 02 · Valle del Cauca
│       │   └── quality.js      Sección 03 · Metodología, calidad y trazabilidad
│       └── main.js             Navegación y arranque
├── data/
│   ├── rud_valle_data.js       window.VALLE_DATA · 42 municipios
│   ├── cali_dashboard_data.js  window.CALI_DATA · agregados de Cali
│   └── geo/
│       ├── cali_map_internal.geojson      Capa primaria del mapa
│       └── rud_cali_consolidated.geojson  Capa de respaldo
└── scripts/
    └── build_cali_dashboard_data.py       Regenera los agregados de Cali
```

Los scripts son clásicos (sin módulos ES) y se cargan en orden desde `index.html`. Comparten el espacio de nombres `window.DASH`; el orden de carga es la dependencia, así que `core/` va siempre antes que `sections/`, y `main.js` al final.

## Uso

Abre `index.html` en un navegador con conexión a internet. Chart.js y Leaflet se cargan desde CDN.

Para publicarlo, puedes subir la carpeta a GitHub Pages, Netlify, Cloudflare Pages o un servidor web estático.

## Alcance de los filtros

Los controles están separados en dos sitios porque tienen alcances distintos:

| Dónde | Controles | Qué reindexa |
|---|---|---|
| Barra superior · **Alcance del análisis** | Territorio, Barrio / vereda | KPIs, gráficos, tablas y el mapa |
| Panel del mapa · **Capa del mapa** | Daño estructural, Buscar dirección | Solo los puntos del mapa |

Los filtros de la capa viven dentro del panel del mapa, justo encima del lienzo, para que el control quede junto a su efecto. El conteo de puntos visibles (`343 de 815 puntos`) se muestra en la etiqueta del panel.

La separación no es cosmética: los agregados del RUD (`views`) están precalculados por zona y por área, pero **no tienen dimensión de daño estructural**. El nivel de daño proviene de las evaluaciones, que cruzan con el 10,8% de los registros del RUD, así que reindexar el tablero por ese eje exigiría regenerar el pipeline con una dimensión nueva.

El campo de barrio/vereda es un combobox propio (no `<datalist>`: el desplegable nativo lo pinta el sistema operativo, no se puede estilar y cambia de navegador a navegador). Se abre al hacer clic, filtra al escribir, se recorre con las flechas y muestra el conteo de registros de cada área. Resuelve sin distinguir mayúsculas ni tildes y avisa cuando lo escrito no corresponde a ninguna área conocida. Al cambiar de zona, la lista se acota a esa zona y se limpia el área si deja de pertenecer.

Renderiza como máximo 200 filas y anuncia cuántas quedan fuera (`y 1.483 más · sigue escribiendo para acotar`), porque hay 1.683 áreas.

> **Ojo con las áreas.** Las etiquetas del RUD no están normalizadas: `LA FLORA` tiene 166 grafías distintas (`FLORA`, `LA  FLORA`, `BARRIO LA FLORA`, `URBANIZACION LA FLORA`…) que suman 5.831 registros, frente a los 4.585 de la etiqueta principal. Lo mismo con Cuarto de Legua (68 variantes) o Santa Elena (53). Seleccionar un área **subcuenta** el barrio real. Normalizar `vereda_bien` en el pipeline es la corrección de fondo; mientras tanto, la búsqueda del combobox sirve para ver la dispersión.

## Datos

Dos globales, cargados por `<script>` antes que la app:

**`window.CALI_DATA`** (`data/cali_dashboard_data.js`) — `meta` · `rud` · `crossed` · `views{all,zones,areas}` · `match` · `citizens` · `coverage` · `sources` · `evaluations` · `areas` · `zones` · `map{center,features}`. `meta.batchDate` marca la fecha de corte y se muestra en la cabecera.

**`window.VALLE_DATA`** (`data/rud_valle_data.js`) — `meta` · `total{records,serious,women,minors,older65}` · `status` · `gender` · `ethnicity` · `priority` · `municipios[{municipio,records,serious,seriousPct,women,minors,older65}]`.

Dos consecuencias de este esquema, que el código ya contempla:

- `total` no trae `stateKnown`; se deriva sumando `status` sin la categoría "No informa" (185.496), para que el KPI de afectación grave siga siendo sobre estado conocido.
- Los municipios llegan con conteos, **sin desglose** de estado, género ni etnia. Esos tres gráficos son departamentales y no reaccionan al filtro de municipio; el panel lo dice explícitamente.
- El donut de confianza del cruce se arma desde `match.highRecords` / `mediumRecords` / `unmatchedRecords`, **no** desde `match.methods`. Ese array es redundante y en el lote 2026-09-01 llegó desfasado (612 en "Alta" cuando `highRecords` ya iba en 9.579). Los tres contadores sí suman `rudRecords` y son la misma fuente que leen los KPIs.
- No hay bloque `quality`: de la sección 03 solo queda vacío el gráfico de completitud por campo.

## Sección 03 · Metodología

Documenta cómo se consolidaron las fuentes: linaje del dato (las cuatro Lambdas y el bucket medallion), las cinco llaves de cruce con sus tasas, los niveles de confianza del cruce por dirección, la normalización aplicada al RUD, la protección de datos bajo la Ley 1581 de 2012 y los límites de lectura.

**Regla de la sección: narrativa estática, cifras vivas.** El texto del método vive en `DASH.config.methodology`; todo número que exista en `CALI_DATA` o `VALLE_DATA` se lee en tiempo de render. El documento metodológico original ya se había desfasado del dato en cuatro puntos tras un solo lote, así que ninguna cifra se escribe en el texto.

La única excepción es `methodology.external`: las tasas de `Reporte ↔ Cluster` y `Cluster ↔ Subcluster`, que se calculan en `resumen_calidad.json` pero todavía no viajan en el bundle. Van marcadas con `·` en la tabla y hay que actualizarlas junto con el lote. Lo correcto es que `aca-prod-dashboard-builder` las publique y dejen de estar escritas a mano.

## Degradación

Los datos son obligatorios; Chart.js y Leaflet no. Si un CDN falla, el tablero muestra un aviso en la cabecera y sigue pintando todo lo que no dependa de esa librería: sin Chart.js quedan los KPIs, las tablas y el mapa; sin Leaflet, todo excepto el mapa. Cada sección se renderiza de forma aislada, así que un error en una no tumba a las demás.

## Mapa de Cali

El RUD es la base principal. `data/geo/cali_map_internal.geojson` contiene la capa interna de puntos con direcciones de referencia, evaluaciones y conteos RUD agregados.

La capa se busca en tres orígenes, en orden: `data/geo/cali_map_internal.geojson`, `data/geo/rud_cali_consolidated.geojson` y, si el navegador bloquea `fetch` (lo que pasa con `file://`), la copia embebida en `CALI_DATA.map.features`. Gracias a ese respaldo el mapa también funciona abriendo el HTML directo, sin servidor.

Aun así, servir la carpeta por HTTP es preferible: `python -m http.server 8000` dentro de la carpeta y abre `http://localhost:8000/`. Así el GeoJSON se puede actualizar sin regenerar el bundle de JavaScript.

## Actualizar agregados

Los archivos crudos no se incluyen en el repositorio. Para regenerar `data/cali_dashboard_data.js` y `data/geo/cali_map_internal.geojson`, coloca el Excel y los JSON en una carpeta de entrada y ejecuta:

```bash
python scripts/build_cali_dashboard_data.py --input-dir ./input --output-dir .
```

## Nota metodológica

La visualización incluye direcciones de referencia porque está diseñada para uso interno autorizado. No contiene nombres, documentos, teléfonos, correos, firmas ni credenciales. Las cifras representan registros individuales vinculados a formularios RUD; no deben interpretarse automáticamente como viviendas únicas ni como prevalencias poblacionales.

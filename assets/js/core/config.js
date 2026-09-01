/* ============================================================
   config.js · rutas, paletas y etiquetas compartidas
   Debe cargarse antes que cualquier otro script de la app.
   ============================================================ */

window.DASH = window.DASH || {};

DASH.config = {
  /* Capas del mapa. La primaria es la versión interna depurada;
     la secundaria solo se usa si la primera no está disponible. */
  dataPaths: {
    mapPrimary: 'data/geo/cali_map_internal.geojson',
    mapFallback: 'data/geo/rud_cali_consolidated.geojson',
  },

  palettes: {
    state: ['#e69a32', '#e36a58', '#55b58f', '#9e3e40', '#b8c2ce'],
    gender: ['#7b61c9', '#3f8ed9', '#e38ab5', '#b8c2ce'],
    categorical: ['#4f86ed', '#55b58f', '#d79b28', '#e36a58', '#7b61c9', '#4d9a96', '#df7590', '#657d9a', '#b8c2ce'],
    tenure: ['#3f8ed9', '#55b58f', '#d79b28', '#e36a58', '#b8c2ce'],
    match: ['#55b58f', '#d79b28', '#b8c2ce'],
    citizens: ['#4f86ed', '#e36a58'],
    severity: ['#e36a58', '#d79b28', '#55b58f', '#b8c2ce', '#7b61c9'],
    severityAlt: ['#e36a58', '#d79b28', '#55b58f', '#4f86ed', '#b8c2ce'],
  },

  /* Color del marcador según el peor nivel de daño del punto. */
  damageColors: {
    alto: '#e36a58',
    medio: '#d79b28',
    bajo: '#2f9d78',
    sin_dano: '#8b98a8',
    sin_dato: '#8b98a8',
    default: '#8b98a8',
  },

  /* Título y subtítulo de la cabecera por sección de navegación. */
  sectionTitles: {
    cali: ['Cali principal', 'Lectura sociodemográfica, territorial y estructural de Cali.'],
    valle: ['Valle del Cauca en general', 'Comparación departamental del Registro Único de Damnificados.'],
    quality: ['Calidad y trazabilidad', 'Reglas, cobertura y controles para interpretar los cruces.'],
  },

  /* Nombres legibles para los campos crudos del RUD. */
  fieldLabels: {
    ganado_aves_peces: 'Ganado / aves / peces',
    cultivos_perdidos: 'Cultivos perdidos',
    corregimiento_bien: 'Corregimiento',
    direccion_bien: 'Dirección del bien',
    telefono: 'Teléfono',
    fecha_nacimiento: 'Fecha de nacimiento',
    numero_documento: 'Documento',
    nombre_genero: 'Género',
  },
};

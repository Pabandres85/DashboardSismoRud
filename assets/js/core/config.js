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
    quality: ['Metodología, calidad y trazabilidad', 'Fuentes, llaves de cruce, normalización y límites de lectura.'],
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

  /* ============================================================
     Metodología de consolidación.

     Solo texto: TODA cifra que exista en CALI_DATA o VALLE_DATA se
     lee en tiempo de render, nunca se escribe aquí. Lo único
     numérico es `external`, que son las tasas de la corrida que el
     bundle todavía no publica.
     ============================================================ */
  methodology: {
    /* Salen de curated/cruces/{fecha}/resumen_calidad.json y hay que
       actualizarlas junto con el lote. Lo correcto a futuro es que
       aca-prod-dashboard-builder las incluya en CALI_DATA para que
       dejen de estar escritas a mano. */
    external: {
      batch: '2026-09-01',
      reportToCluster: { universe: 12490, matched: 11434 },
      clusterToSubcluster: { universe: 12490, matched: 10509 },
      subclusters: 15580,
    },

    lineage: [
      ['Extracción', '<code>aca-prod-instantdb-to-s3</code> baja 9 tablas de InstantDB por Admin API y las deja en <code>raw/blend_instantdb/</code>. El RUD llega aparte como Excel acumulativo diario en <code>raw/censo_afectaciones/</code>.'],
      ['Cruces', '<code>aca-prod-etl-cruces-sismo</code> normaliza y resuelve los cuatro cruces; publica en <code>curated/cruces/{fecha}/</code> junto con <code>resumen_calidad.json</code>.'],
      ['Publicación', '<code>aca-prod-dashboard-builder</code> genera <code>cali_dashboard_data.js</code>, <code>rud_valle_data.js</code> y <code>cali_map_internal.geojson</code> en <code>analytics/dashboard/</code>.'],
      ['Consumo', 'Este tablero estático lee esos tres archivos. Bucket <code>aca-prod-calitrack-sismo-cali</code>, estructura medallion <code>raw/ → curated/ → analytics/</code>.'],
    ],

    normalization: [
      ['<code>estado_bien</code> concatenado', 'Cuando trae varios valores separados por <code>;</code> se toma el de mayor severidad: Destruido &gt; No Habitable &gt; Averiado &gt; Habitable.'],
      ['<code>tenencia_bien</code> concatenada', 'Mismo tratamiento que el estado del bien.'],
      ['<code>direccion_bien</code> concatenada', 'Se toma la primera dirección antes del <code>;</code>.'],
      ['<code>fecha_nacimiento</code>', 'Se parsean formatos mixtos (fecha real y serial de Excel) para calcular la edad al 10/08/2026. Grupos: 0–5, 6–12, 13–17, 18–24, 25–29, 30–44, 45–59, 60–64, 65+.'],
      ['Zona urbana / rural', 'Rural si <code>corregimiento_bien</code> trae un valor real; urbana en caso contrario.'],
      ['<code>road_key</code>', 'Unifica CALLE/CLL/CL en CL y CARRERA/CRA/KR en CR, y extrae tipo + vía + placa en formato <code>CL56-3-88</code>.'],
    ],

    privacy: [
      'Nombre completo, token y hash de contraseña no salen de <code>raw/</code>.',
      'Documento: SHA-256 truncado, se muestra como <code>C-XXXXXXXXXX</code>.',
      'Teléfono: enmascarado <code>••••XXXX</code>.',
      'Direcciones: se incluyen como referencia operativa de uso interno.',
      'Coordenadas: provienen del <code>placeId</code> del reporte ciudadano, no del domicilio de la persona.',
    ],

    /* Los límites con cifra se completan en tiempo de render. */
    limits: [
      'Las relaciones de grafo de InstantDB están declaradas en el schema pero nunca fueron pobladas: <code>ciudadano ↔ reporte</code> no existe como dato, y por eso todo cruce se resuelve por campos compartidos.',
      'El cruce por dirección depende de la calidad de la digitación del PMU: una nomenclatura mal escrita no se recupera.',
      '<code>placesV2.geojson</code>, curado externamente, no se usa: los cruces se hacen contra <code>clusterReporte</code> crudo.',
      'Las cifras son registros del RUD, no viviendas únicas ni prevalencias poblacionales.',
    ],
  },
};

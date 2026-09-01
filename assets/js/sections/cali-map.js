/* ============================================================
   cali-map.js · capa Leaflet de puntos consolidados de Cali.

   Los puntos se buscan en tres sitios, en orden: el GeoJSON
   interno, el consolidado de respaldo y -si el navegador bloquea
   fetch, como pasa con file://- la copia embebida en
   CALI_DATA.map.features. Así el mapa funciona también abriendo
   el HTML directo, sin servidor.
   ============================================================ */

window.DASH = window.DASH || {};

(() => {
  const { $, fmt, escapeHtml, normalizedText } = DASH.utils;
  const { dataPaths, damageColors } = DASH.config;

  let map = null;
  let layer = null;
  let features = [];
  let index = [];
  let loaded = false;

  function markerColor(feature) {
    const risk = String(feature.properties?.nivel_dano_max || 'sin_dato');
    return damageColors[risk] || damageColors.default;
  }

  function popupHtml(feature) {
    const p = feature.properties || {};
    return [
      `<strong>${escapeHtml(p.address || 'Dirección no informada')}</strong>`,
      `Área: ${escapeHtml(p.area || 'Sin información')}`,
      `Zona: ${escapeHtml(p.zone || 'Sin información')}`,
      `Registros RUD: ${fmt.format(Number(p.rud_records || 0))}`,
      `Personas únicas: ${fmt.format(Number(p.rud_unique_docs || 0))}`,
      `Evaluaciones: ${fmt.format(Number(p.evaluation_count || 0))}`,
      `Nivel de daño: ${escapeHtml(p.nivel_dano_max || 'Sin evaluación')}`,
      `Severidad: ${escapeHtml(p.severidad_max || 'Sin evaluación')}`,
    ].join('<br>');
  }

  /* Claves de filtrado precalculadas una vez por punto. Con 10.646
     puntos, normalizar en cada pulsación de tecla se nota. */
  function buildIndex() {
    index = features.map(feature => {
      const p = feature.properties || {};
      return {
        feature,
        risk: String(p.nivel_dano_max || 'sin_dato'),
        zone: p.zone || '',
        /* El GeoJSON trae las áreas en Título ("Altos de Santa Elena")
           y el RUD en mayúsculas ("ALTOS DE SANTA ELENA"): comparar
           en crudo dejaba el mapa casi vacío al elegir un área. */
        area: normalizedText(p.area),
        text: normalizedText([p.address, p.area, p.zone].join(' ')),
      };
    });
  }

  /* Zona y área vienen del alcance del tablero; daño y búsqueda
     son exclusivos de esta capa. */
  function visibleFeatures() {
    const risk = DASH.filters.damage();
    const zone = DASH.filters.zone();
    const area = DASH.filters.area();
    const areaKey = area === 'ALL' ? '' : normalizedText(area);
    const search = normalizedText(DASH.filters.search());
    return index.filter(entry =>
      (risk === 'ALL' || entry.risk === risk)
      && (zone === 'ALL' || entry.zone === zone)
      && (!areaKey || entry.area === areaKey)
      && (!search || entry.text.includes(search))
    ).map(entry => entry.feature);
  }

  /* Radio logarítmico: evita que un punto con muchos registros
     tape a sus vecinos. */
  function markerRadius(feature) {
    const weight = Number(feature.properties?.rud_records || 0) + Number(feature.properties?.evaluation_count || 0);
    return 4 + Math.min(8, Math.log10(weight + 1) * 3);
  }

  /* El conteo vive en la etiqueta del panel, justo encima de los
     filtros de la capa. */
  function setCount(text) {
    const status = $('map-status');
    if (status) status.textContent = text;
  }

  function update() {
    if (!map || !window.L || !loaded) return;
    const filtered = visibleFeatures();
    if (layer) layer.remove();
    layer = L.geoJSON({ type: 'FeatureCollection', features: filtered }, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
        radius: markerRadius(feature),
        color: markerColor(feature),
        weight: 1,
        fillColor: markerColor(feature),
        fillOpacity: .75,
      }),
      onEachFeature: (feature, layerRef) => layerRef.bindPopup(popupHtml(feature)),
    }).addTo(map);
    if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds().pad(.12));
    setCount(`${fmt.format(filtered.length)} de ${fmt.format(features.length)} puntos`);
  }

  /* Devuelve {features, source} del primer origen que responda. */
  async function loadFeatures() {
    for (const url of [dataPaths.mapPrimary, dataPaths.mapFallback]) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const geojson = await response.json();
        if (geojson.features?.length) return { features: geojson.features, source: url };
      } catch (error) {
        /* file:// o red caída: se intenta el siguiente origen. */
      }
    }
    const embedded = window.CALI_DATA?.map?.features;
    if (embedded?.length) return { features: embedded, source: 'embebido' };
    return null;
  }

  /* Crea el mapa la primera vez y carga la capa de puntos. */
  async function ensure() {
    if (!window.L || map) return;
    /* preferCanvas: con 10.646 marcadores, SVG deja el mapa inusable. */
    map = L.map('cali-map', { scrollWheelZoom: false, preferCanvas: true })
      .setView(window.CALI_DATA.map.center, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const result = await loadFeatures();
    if (!result) {
      $('geojson-status').textContent = 'No hay capa de puntos disponible.';
      setCount('Mapa sin capa');
      return;
    }
    features = result.features;
    buildIndex();
    loaded = true;
    const origin = result.source === 'embebido' ? ' · origen embebido' : '';
    $('geojson-status').textContent = `Puntos internos consolidados · ${fmt.format(features.length)} referencias${origin}`;
    update();
  }

  /* Leaflet necesita recalcular tamaño cuando el panel pasa de
     display:none a visible. */
  function invalidate() {
    setTimeout(() => map?.invalidateSize(), 80);
  }

  /* Estado para el aviso global cuando Leaflet no está. */
  function unavailable(reason) {
    $('geojson-status').textContent = reason;
    setCount('Mapa no disponible');
  }

  DASH.caliMap = { ensure, update, invalidate, unavailable };
})();

/* ============================================================
   quality.js · sección 03, metodología, calidad y trazabilidad.

   Regla de la sección: la narrativa del método vive en
   DASH.config.methodology, pero TODA cifra que exista en el lote
   se lee de CALI_DATA / VALLE_DATA en tiempo de render. El
   documento metodológico ya se había desfasado del dato en varios
   puntos tras un solo lote; escribir números en el texto garantiza
   que vuelva a pasar.

   Lo único que sigue dependiendo de un bloque que el export aún no
   publica es el gráfico de completitud por campo (`quality`).
   ============================================================ */

window.DASH = window.DASH || {};

(() => {
  const { $, fmt, pct } = DASH.utils;
  const { fieldLabels, methodology, palettes } = DASH.config;
  const { barOptions, labels, values, draw, destroy, donut } = DASH.charts;

  const C = () => window.CALI_DATA;
  const quality = () => window.VALLE_DATA?.quality;

  const rate = (n, d) => (d ? `${(n / d * 100).toFixed(1)}%` : '—');

  /* --- Tarjetas de encabezado -------------------------------- */

  function renderCards() {
    const data = C();
    const cards = [
      ['Cobertura de direcciones', `${data.coverage.addressCoveragePct.toFixed(1)}%`,
        `${fmt.format(data.coverage.addressRecords)} de ${fmt.format(data.rud.records)} registros del RUD Cali`],
      ['RUD cruzado con reportes', `${data.match.matchedPct.toFixed(1)}%`,
        `${fmt.format(data.match.matchedRecords)} registros con dirección resuelta`],
      ['Puntos validados en el mapa', fmt.format(data.sources.canonicalMapPoints),
        `de ${fmt.format(data.sources.places)} clusters; el resto son reportes sin validar`],
      ['Etiquetas de barrio sin normalizar', fmt.format(data.areas.length),
        `para ${fmt.format(data.rud.records)} registros: el mismo barrio aparece con muchas grafías`],
    ];
    $('quality-cards').innerHTML = cards
      .map(card => `<article class="quality-card"><div class="q-label">${card[0]}</div><div class="q-value">${card[1]}</div><div class="q-meta">${card[2]}</div></article>`)
      .join('');
  }

  /* --- Tabla de cruces --------------------------------------- */

  /* `bundled: false` marca las filas cuyo dato todavía no viaja en
     CALI_DATA y hay que refrescar con el lote. */
  function crossRows() {
    const data = C();
    const ext = methodology.external;
    return [
      {
        name: 'Evaluación EDE ↔ Reporte',
        key: 'GPS ≤ 50 m (geohash + Haversine)',
        universe: data.sources.structuralEvaluations,
        matched: data.sources.structuralEvaluations,
        bundled: true,
      },
      {
        name: 'Ciudadano ↔ RUD',
        key: 'Documento normalizado',
        universe: data.citizens.total,
        matched: data.citizens.matchedRudCali,
        bundled: true,
      },
      {
        name: 'RUD ↔ Reportes',
        key: 'road_key, y barrio en el nivel 2',
        universe: data.match.rudRecords,
        matched: data.match.matchedRecords,
        bundled: true,
      },
      {
        name: 'Reporte ↔ Cluster',
        key: 'placeId de Google',
        universe: ext.reportToCluster.universe,
        matched: ext.reportToCluster.matched,
        bundled: false,
      },
      {
        name: 'Cluster ↔ Subcluster',
        key: 'geohash',
        universe: ext.clusterToSubcluster.universe,
        matched: ext.clusterToSubcluster.matched,
        bundled: false,
      },
    ];
  }

  function renderCrossTable() {
    const rows = crossRows();
    $('quality-cross-table').innerHTML = rows.map(row => {
      const mark = row.bundled ? '' : ' <span class="cross-external" title="No viaja en el bundle">·</span>';
      return `<tr><td>${row.name}${mark}</td><td class="cross-key">${row.key}</td><td>${fmt.format(row.universe)}</td><td>${fmt.format(row.matched)}</td><td class="rate">${rate(row.matched, row.universe)}</td></tr>`;
    }).join('');
    $('quality-cross-tag').textContent = `${rows.length} cruces · lote ${methodology.external.batch}`;
  }

  /* --- Confianza del cruce por dirección --------------------- */

  function renderConfidence() {
    const m = C().match;
    donut('quality-confidence-chart', [
      { label: 'Alta · road_key único', value: m.highRecords },
      { label: 'Media · road_key + barrio', value: m.mediumRecords },
      { label: 'Sin coincidencia', value: m.unmatchedRecords },
    ], palettes.match);
    $('quality-confidence-note').innerHTML = `<strong>Alta:</strong> el <code>road_key</code> del RUD coincide con exactamente un cluster. `
      + `<strong>Media:</strong> coincide con varios, pero <code>road_key</code> + barrio resuelve a uno solo. `
      + `Solo se enlaza cuando el candidato es único, por eso ${rate(m.unmatchedRecords, m.rudRecords)} queda sin cruzar.`;
  }

  /* --- Bloques narrativos ------------------------------------ */

  function renderNarrative() {
    $('quality-lineage').innerHTML = methodology.lineage
      .map(([title, text]) => `<li><strong>${title}:</strong> ${text}</li>`).join('');
    $('quality-normalization').innerHTML = methodology.normalization
      .map(([title, text]) => `<li><strong>${title}:</strong> ${text}</li>`).join('');
    $('quality-privacy').innerHTML = methodology.privacy
      .map(item => `<li>${item}</li>`).join('');
  }

  /* Los dos primeros límites se calculan del lote para que no
     envejezcan; el resto son estructurales. */
  function renderLimits() {
    const data = C();
    const derived = [
      `<strong>${rate(data.match.unmatchedRecords, data.match.rudRecords)} del RUD sin cruce</strong> (${fmt.format(data.match.unmatchedRecords)} registros): la dirección no fue reportada en Blend, o la nomenclatura no es compatible.`,
      `<strong>${(100 - data.coverage.sectorCoveragePct).toFixed(1)}% sin barrio</strong>: <code>vereda_bien</code> quedó vacío en la digitación.`,
    ];
    $('quality-limits').innerHTML = derived.concat(methodology.limits)
      .map(item => `<li>${item}</li>`).join('');
  }

  /* --- Completitud por campo (depende del bloque `quality`) --- */

  function prettyField(field) {
    return fieldLabels[field] || field;
  }

  function renderMissingChart(data) {
    const missing = data.missing
      .slice()
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 10)
      .map(item => ({ label: prettyField(item.field), value: item.pct }));

    const options = barOptions(true);
    draw('quality-missing-chart', 'bar', {
      labels: labels(missing),
      datasets: [{ data: values(missing), backgroundColor: '#e69a32', borderRadius: 5, barThickness: 13 }],
    }, {
      ...options,
      scales: {
        ...options.scales,
        x: { ...options.scales.x, max: 100, ticks: { ...options.scales.x.ticks, callback: value => `${value}%` } },
      },
    });

    $('quality-missing-tag').textContent = 'RUD';
    $('quality-missing-note').innerHTML = `Documentos repetidos: <strong>${fmt.format(data.duplicateDocumentValues)}</strong> · `
      + `formularios reutilizados entre municipios: <strong>${fmt.format(data.formNumbersReusedAcrossMunicipalities)}</strong>.`;
  }

  function renderMissingEmpty() {
    destroy('quality-missing-chart');
    $('quality-missing-tag').textContent = 'Sin datos';
    $('quality-missing-note').innerHTML = 'El export de <code>VALLE_DATA</code> no trae el bloque <code>quality</code>. '
      + 'Las métricas ya se calculan en <code>curated/cruces/{fecha}/resumen_calidad.json</code>: basta con que '
      + '<code>aca-prod-dashboard-builder</code> las incluya como <code>quality: { missing[{field, missing, pct}], '
      + 'duplicateDocumentValues, formNumbersReusedAcrossMunicipalities }</code>.';
  }

  function render() {
    renderCards();
    renderCrossTable();
    renderConfidence();
    renderNarrative();
    renderLimits();

    const data = quality();
    if (data?.missing?.length) renderMissingChart(data);
    else renderMissingEmpty();
  }

  DASH.quality = { render };
})();

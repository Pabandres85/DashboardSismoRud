/* ============================================================
   quality.js · sección 03, controles de calidad del RUD.

   Depende del bloque `quality` del RUD departamental (campos
   vacíos, documentos y teléfonos repetidos, formularios
   reutilizados). Si la entrega de datos no lo trae, la sección
   lo dice en lugar de quedarse en blanco: las reglas de lectura
   del panel contiguo siguen siendo válidas igualmente.
   ============================================================ */

window.DASH = window.DASH || {};

(() => {
  const { $, fmt } = DASH.utils;
  const { fieldLabels } = DASH.config;
  const { barOptions, labels, values, draw, destroy } = DASH.charts;

  const quality = () => window.VALLE_DATA?.quality;

  function prettyField(field) {
    return fieldLabels[field] || field;
  }

  function missingPct(data, field) {
    return data.missing.find(item => item.field === field)?.pct ?? 0;
  }

  function renderCards(data) {
    const cards = [
      ['Campos productivos vacíos', `${missingPct(data, 'cultivos_perdidos').toFixed(1)}%`, 'Cultivos perdidos'],
      ['Documentos repetidos', fmt.format(data.duplicateDocumentValues), 'Valores no nulos duplicados'],
      ['Direcciones incompletas', `${missingPct(data, 'direccion_bien').toFixed(1)}%`, 'RUD departamental'],
      ['Formularios reutilizados', fmt.format(data.formNumbersReusedAcrossMunicipalities), 'En más de un municipio'],
    ];
    $('quality-cards').innerHTML = cards
      .map(card => `<article class="quality-card"><div class="q-label">${card[0]}</div><div class="q-value">${card[1]}</div><div class="q-meta">${card[2]}</div></article>`)
      .join('');
  }

  /* Eje fijo a 100 porque los valores ya son porcentajes. */
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
    $('quality-missing-note').textContent = '';
  }

  function renderEmpty() {
    destroy('quality-missing-chart');
    $('quality-cards').innerHTML = `<article class="quality-card empty"><div class="q-label">Sin métricas de calidad en esta entrega</div><div class="q-value">—</div><div class="q-meta">El export de <code>VALLE_DATA</code> no incluye el bloque <code>quality</code></div></article>`;
    $('quality-missing-tag').textContent = 'Sin datos';
    $('quality-missing-note').textContent = 'Para volver a poblar esta sección, el export departamental debe traer '
      + '`quality` con `missing[{field, missing, pct}]`, `duplicateDocumentValues` y `formNumbersReusedAcrossMunicipalities`.';
  }

  function render() {
    const data = quality();
    if (!data?.missing?.length) {
      renderEmpty();
      return;
    }
    renderCards(data);
    renderMissingChart(data);
  }

  DASH.quality = { render };
})();

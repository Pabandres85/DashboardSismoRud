/* ============================================================
   valle.js · sección 02, comparación departamental.

   Lee window.VALLE_DATA. Esta entrega trae las distribuciones
   (estado, género, etnia, edad) solo a nivel departamental: los
   municipios llegan con conteos, no con desglose. Por eso esos
   tres gráficos se marcan como departamentales y no reaccionan
   al filtro de municipio.
   ============================================================ */

window.DASH = window.DASH || {};

(() => {
  const { $, fmt, pct } = DASH.utils;
  const { palettes } = DASH.config;
  const { donut, bars } = DASH.charts;

  const V = () => window.VALLE_DATA;

  function selected() {
    return $('valle-municipality-filter')?.value || 'ALL';
  }

  function municipality() {
    const value = selected();
    return value === 'ALL' ? null : V().municipios.find(item => item.municipio === value) || null;
  }

  /* `total` no trae stateKnown, pero se deriva del propio reparto
     de estados descartando "No informa". */
  function departmentStateKnown() {
    return V().status.reduce((sum, item) => sum + (item.label === 'No informa' ? 0 : item.value), 0);
  }

  const byRecords = (a, b) => b.records - a.records;
  const byPriority = (a, b) => (b.minors + b.older65) - (a.minors + a.older65);

  function render() {
    const data = V();
    const current = municipality() || data.total;
    const isSingle = Boolean(municipality());

    $('valle-records').textContent = fmt.format(current.records);
    $('valle-records-meta').textContent = isSingle
      ? `${current.municipio} · ${pct(current.records, data.total.records)} del departamento`
      : `${fmt.format(data.municipios.length)} municipios`;

    /* El municipio ya trae su porcentaje sobre estado conocido;
       para el total hay que derivarlo. */
    $('valle-serious').textContent = isSingle
      ? `${current.seriousPct.toFixed(1)}%`
      : pct(current.serious, departmentStateKnown());
    $('valle-priority').textContent = pct(current.minors + current.older65, current.records);
    $('valle-women').textContent = pct(current.women, current.records);
    $('valle-tag').textContent = 'Departamento';

    /* Sin desglose por municipio en esta entrega. */
    donut('valle-state-chart', data.status, palettes.state);
    donut('valle-gender-chart', data.gender, palettes.gender);
    bars('valle-ethnicity-chart', data.ethnicity, palettes.categorical, 7);

    const municipios = isSingle
      ? [{ label: current.municipio, value: current.records }]
      : data.municipios.slice().sort(byRecords).map(item => ({ label: item.municipio, value: item.records }));
    bars('valle-municipality-chart', municipios, '#4f86ed', 15);

    const priority = isSingle
      ? [{ label: current.municipio, value: current.minors + current.older65 }]
      : data.municipios.slice().sort(byPriority).map(item => ({ label: item.municipio, value: item.minors + item.older65 }));
    bars('valle-priority-chart', priority, '#d79b28', 10);

    const rows = isSingle
      ? [current]
      : data.municipios.slice().sort((a, b) => b.serious - a.serious).slice(0, 15);
    $('valle-table').innerHTML = rows
      .map(item => `<tr><td>${item.municipio}</td><td>${fmt.format(item.records)}</td><td class="rate">${item.seriousPct.toFixed(1)}%</td><td>${pct(item.minors + item.older65, item.records)}</td></tr>`)
      .join('');
  }

  function init() {
    V().municipios
      .slice()
      .sort((a, b) => a.municipio.localeCompare(b.municipio, 'es'))
      .forEach(item => {
        const option = document.createElement('option');
        option.value = item.municipio;
        option.textContent = item.municipio;
        $('valle-municipality-filter').appendChild(option);
      });
    $('valle-municipality-filter').addEventListener('change', render);
  }

  DASH.valle = { init, render };
})();

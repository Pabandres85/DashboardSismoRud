/* ============================================================
   charts.js · registro de instancias Chart.js y constructores
   de los tres tipos de gráfico que usa el panel.
   ============================================================ */

window.DASH = window.DASH || {};

(() => {
  const { $ } = DASH.utils;
  const { palettes } = DASH.config;

  /* Una instancia viva por id de canvas. Se destruye antes de
     volver a dibujar para evitar fugas al cambiar de filtro. */
  const registry = {};

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 350 },
    plugins: {
      legend: {
        labels: { usePointStyle: true, boxWidth: 8, padding: 14, font: { family: 'DM Sans', size: 10 } },
      },
      tooltip: {
        backgroundColor: '#10253d',
        padding: 10,
        titleFont: { family: 'DM Sans', size: 11 },
        bodyFont: { family: 'DM Sans', size: 11 },
      },
    },
  };

  const barOptions = (horizontal = false) => ({
    ...baseOptions,
    indexAxis: horizontal ? 'y' : 'x',
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 }, color: '#7f8c9b' } },
      y: { grid: { color: '#edf0f4' }, ticks: { font: { family: 'DM Sans', size: 10 }, color: '#7f8c9b' }, beginAtZero: true },
    },
    plugins: { ...baseOptions.plugins, legend: { display: false } },
  });

  const labels = items => items.map(item => item.label);
  const values = items => items.map(item => item.value);

  function destroy(id) {
    if (registry[id]) {
      registry[id].destroy();
      delete registry[id];
    }
  }

  function draw(id, type, data, options = {}) {
    if (!window.Chart || !$(id)) return;
    destroy(id);
    registry[id] = new Chart($(id), { type, data, options: { ...baseOptions, ...options } });
  }

  /* Dona con leyenda inferior. */
  function donut(id, items, colors = palettes.categorical) {
    draw(id, 'doughnut', {
      labels: labels(items),
      datasets: [{
        data: values(items),
        backgroundColor: items.map((_, i) => colors[i % colors.length]),
        borderWidth: 0,
        hoverOffset: 5,
      }],
    }, {
      cutout: '68%',
      plugins: {
        ...baseOptions.plugins,
        legend: { position: 'bottom', labels: { ...baseOptions.plugins.legend.labels, padding: 12 } },
      },
    });
  }

  /* Barras horizontales, ordenadas de mayor a menor y recortadas
     a `max` categorías. `color` admite un string o un array. */
  function bars(id, items, color = '#4f86ed', max = 14) {
    const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, max);
    draw(id, 'bar', {
      labels: labels(sorted),
      datasets: [{
        data: values(sorted),
        backgroundColor: Array.isArray(color) ? color.slice(0, sorted.length) : color,
        borderRadius: 5,
        barThickness: 14,
      }],
    }, barOptions(true));
  }

  DASH.charts = { baseOptions, barOptions, labels, values, destroy, draw, donut, bars };
})();

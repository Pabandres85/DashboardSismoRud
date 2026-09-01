/* ============================================================
   main.js · arranque. Debe cargarse en último lugar.

   Las dependencias se degradan por separado: los datos son
   obligatorios, pero si falla Chart.js o Leaflet el resto del
   tablero -KPIs, tablas, cobertura, trazabilidad- sigue en pie
   y el usuario ve qué falta en lugar de una página en blanco.
   ============================================================ */

(() => {
  const { $ } = DASH.utils;
  const { sectionTitles } = DASH.config;

  const notices = [];

  function notice(text, level = 'warn') {
    notices.push({ text, level });
    const box = $('app-notice');
    if (!box) return;
    box.hidden = false;
    box.className = `app-notice ${notices.some(item => item.level === 'error') ? 'error' : 'warn'}`;
    box.innerHTML = notices
      .map(item => `<div><span class="notice-dot"></span>${item.text}</div>`)
      .join('');
  }

  /* Ejecuta un render aislado: un fallo en una sección no debe
     impedir que se pinten las demás. */
  function safely(label, fn) {
    try {
      fn();
    } catch (error) {
      console.error(`[${label}]`, error);
      notice(`La sección «${label}» no se pudo renderizar. Revisa la consola.`, 'error');
    }
  }

  function activateSection(name) {
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    $(`section-${name}`).classList.add('active');
    const [title, subtitle] = sectionTitles[name];
    $('page-title').textContent = title;
    $('page-subtitle').textContent = subtitle;
    /* El mapa se dimensiona mal si se creó dentro de un panel oculto. */
    if (name === 'cali') DASH.caliMap.invalidate();
  }

  function setupNav() {
    document.querySelectorAll('.nav-item').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        activateSection(button.dataset.section);
      });
    });
  }

  /* La entrega de datos trae su propia fecha de corte: mostrarla
     evita leer el tablero contra un lote que no es el que se cree. */
  function stampBatchDate() {
    const batch = window.CALI_DATA?.meta?.batchDate;
    const badge = document.querySelector('.header-badge strong');
    if (batch && badge) badge.textContent = `RUD + fuentes de respuesta · corte ${batch}`;
  }

  function boot() {
    const missing = [];
    if (!window.VALLE_DATA) missing.push('data/rud_valle_data.js');
    if (!window.CALI_DATA) missing.push('data/cali_dashboard_data.js');
    if (missing.length) {
      notice(`No se cargaron los datos (${missing.join(', ')}). El tablero no puede arrancar.`, 'error');
      return;
    }

    if (!window.Chart) notice('Chart.js no se cargó desde el CDN: se muestran KPIs, tablas y mapa, pero no los gráficos.');
    if (!window.L) {
      notice('Leaflet no se cargó desde el CDN: el mapa de puntos no está disponible.');
      DASH.caliMap.unavailable('Leaflet no disponible.');
    }

    stampBatchDate();
    safely('Cali', () => { DASH.cali.init(); DASH.cali.render(); });
    safely('Valle del Cauca', () => { DASH.valle.init(); DASH.valle.render(); });
    safely('Calidad y trazabilidad', () => DASH.quality.render());
    setupNav();
  }

  boot();
})();

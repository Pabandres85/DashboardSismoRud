/* ============================================================
   cali.js · sección 01, vista principal de Cali.
   Tres modos de lectura sobre el mismo alcance territorial:
   RUD, RUD cruzado con evaluaciones, y ciudadanos vs RUD.
   ============================================================ */

window.DASH = window.DASH || {};

(() => {
  const { $, fmt, pct, normalizedText, escapeHtml } = DASH.utils;
  const { palettes } = DASH.config;
  const { donut, bars } = DASH.charts;
  const filters = DASH.filters;

  const C = () => window.CALI_DATA;

  const MODE_TEXT = {
    rud: 'RUD de Cali como base principal',
    crossed: 'RUD asociado a autoevaluaciones y visitas',
    citizens: 'Ciudadanos comparados con documentos del RUD',
  };

  /* Vista precalculada del alcance actual para un tipo de conteo
     ('rud' o 'crossed'). Precedencia: área > zona > Cali completa. */
  function scopeFor(kind) {
    const data = C();
    const area = filters.area();
    const zone = filters.zone();
    let view = data.views.all;
    if (area !== 'ALL' && data.views.areas[area]) view = data.views.areas[area];
    else if (zone !== 'ALL' && data.views.zones[zone]) view = data.views.zones[zone];
    return view[kind] || data.rud;
  }

  /* El modo 'citizens' ignora el territorio porque el cruce por
     documento no tiene ubicación asociada. */
  function scope() {
    return filters.mode === 'citizens' ? C().rud : scopeFor(filters.mode);
  }

  /* --- Combobox de áreas ------------------------------------ */

  /* Combobox propio en lugar de <datalist>: el desplegable nativo
     lo pinta el sistema operativo, no se puede estilar, cambia de
     navegador a navegador y no se deja recorrer como un <select>.
     Aquí la lista es DOM normal, con las 1.683 áreas accesibles. */

  const MAX_OPTIONS = 200;

  let pool = [];        /* opciones visibles ahora mismo */
  let activeIndex = -1; /* opción resaltada con el teclado */

  function areasForZone() {
    const zone = filters.zone();
    return C().areas.filter(item => zone === 'ALL' || item.zone === zone);
  }

  /* Recalcula la lista según lo escrito y la vuelve a pintar. */
  function renderList() {
    const list = $('cali-area-list');
    if (!list) return;
    const query = normalizedText($('cali-area-filter').value);
    const matches = areasForZone().filter(item => !query || normalizedText(item.label).includes(query));
    pool = matches.slice(0, MAX_OPTIONS);

    const rows = pool.map((item, index) => {
      const active = index === activeIndex ? ' active' : '';
      const current = filters.area() === item.label ? ' selected' : '';
      return `<li class="combo-option${active}${current}" role="option" data-index="${index}"><span>${escapeHtml(item.label)}</span><em>${fmt.format(item.records)}</em></li>`;
    }).join('');

    const clear = `<li class="combo-option combo-clear" role="option" data-index="-1"><span>Todas las áreas</span><em>${fmt.format(matches.length)} áreas</em></li>`;
    const more = matches.length > pool.length
      ? `<li class="combo-more">y ${fmt.format(matches.length - pool.length)} más · sigue escribiendo para acotar</li>`
      : '';
    const empty = matches.length ? '' : '<li class="combo-empty">Ninguna área coincide</li>';

    list.innerHTML = clear + rows + more + empty;
  }

  function openCombo() {
    const list = $('cali-area-list');
    if (!list || !list.hidden) return;
    activeIndex = -1;
    renderList();
    list.hidden = false;
    $('cali-area-filter').setAttribute('aria-expanded', 'true');
  }

  function closeCombo() {
    const list = $('cali-area-list');
    if (!list) return;
    list.hidden = true;
    activeIndex = -1;
    $('cali-area-filter').setAttribute('aria-expanded', 'false');
  }

  /* Aplica un área (o la limpia con cadena vacía) y refresca todo. */
  function selectArea(label) {
    $('cali-area-filter').value = label || '';
    closeCombo();
    render();
  }

  function moveActive(step) {
    if ($('cali-area-list')?.hidden) { openCombo(); return; }
    if (!pool.length) return;
    activeIndex = (activeIndex + step + pool.length + 1) % (pool.length + 1) - 1;
    renderList();
  }

  /* Al cambiar de zona, un área que ya no pertenece a esa zona
     deja de ser válida: se limpia en lugar de quedar fantasma. */
  function pruneAreaForZone() {
    const zone = filters.zone();
    if (zone === 'ALL') return;
    const area = filters.area();
    if (area === 'ALL') return;
    if (C().views.areas[area]?.zone !== zone) $('cali-area-filter').value = '';
  }

  function renderAreaHint() {
    const hint = $('cali-area-hint');
    if (!hint) return;
    if (filters.areaIsUnknown()) {
      hint.textContent = 'Área no reconocida · se muestra el alcance completo';
      hint.classList.add('warn');
    } else {
      hint.textContent = '';
      hint.classList.remove('warn');
    }
  }

  /* --- KPIs -------------------------------------------------- */

  function renderKpis(current) {
    const data = C();
    const isCitizen = filters.mode === 'citizens';
    const isCrossed = filters.mode === 'crossed';
    const hasTerritory = filters.hasTerritory();
    const territoryRud = scopeFor('rud');

    $('cali-kpi-records').textContent = fmt.format(isCitizen ? data.citizens.total : current.records);
    $('cali-kpi-unique').textContent = fmt.format(isCitizen ? data.citizens.matchedRudCali : current.uniqueDocs);
    $('cali-kpi-households').textContent = fmt.format(isCitizen ? data.citizens.unmatchedRudCali : current.households);

    /* En modo cruzado el conteo de coincidencias ya es el KPI 1,
       así que aquí se muestra su cobertura sobre el RUD del mismo
       alcance, que sí aporta información nueva. */
    $('cali-kpi-match').textContent = isCitizen
      ? `${data.citizens.coveragePct.toFixed(1)}%`
      : isCrossed
        ? pct(current.records, territoryRud.records)
        : fmt.format(hasTerritory ? scopeFor('crossed').records : data.match.matchedRecords);

    $('label-kpi-records').textContent = isCitizen ? 'CIUDADANOS CON CÉDULA' : isCrossed ? 'REGISTROS RUD CRUZADOS' : 'REGISTROS RUD';
    $('label-kpi-unique').textContent = isCitizen ? 'CIUDADANOS EN EL RUD' : 'PERSONAS ÚNICAS';
    $('label-kpi-households').textContent = isCitizen ? 'CIUDADANOS SIN CRUCE' : 'HOGARES / FORMULARIOS';
    $('label-kpi-match').textContent = isCitizen || isCrossed ? 'COBERTURA DEL CRUCE' : 'RUD CON CRUCE';

    $('meta-kpi-records').textContent = isCitizen
      ? 'Registros de ciudadano disponibles'
      : hasTerritory ? `${filters.zone() === 'ALL' ? 'Área seleccionada' : filters.zone()} · Cali` : 'Cali';
    $('meta-kpi-unique').textContent = isCitizen ? 'Documento coincidente con RUD Cali' : 'Documento normalizado como llave interna';
    $('meta-kpi-households').textContent = isCitizen ? 'Ciudadanos del archivo sin coincidencia en RUD Cali' : 'Conteo del RUD en el alcance seleccionado';
    $('meta-kpi-match').textContent = isCitizen
      ? 'Comparación por documento; sin ubicación individual'
      : isCrossed
        ? `${fmt.format(current.records)} de ${fmt.format(territoryRud.records)} registros RUD del alcance`
        : 'Dirección normalizada y nomenclatura + área';

    $('cali-state-tag').textContent = hasTerritory
      ? (filters.area() !== 'ALL' ? filters.area() : filters.zone())
      : 'Cali';
    $('cali-insight').innerHTML = `<span class="alert-dot"></span><span><strong>${MODE_TEXT[filters.mode]}.</strong> ${fmt.format(current.records)} registros en el alcance actual; ${pct(current.serious, current.stateKnown)} presentan afectación grave según el estado reportado en el RUD.</span>`;
  }

  /* --- Gráficos ---------------------------------------------- */

  function renderCharts(current) {
    const data = C();
    const areaField = filters.mode === 'crossed' ? 'matchedRecords' : 'records';

    donut('cali-state-chart', current.status, palettes.state);
    bars('cali-age-chart', current.age, '#4f86ed', 10);
    donut('cali-gender-chart', current.gender, palettes.gender);
    bars('cali-ethnicity-chart', current.ethnicity, palettes.categorical, 7);
    bars('cali-zone-chart', data.zones.map(item => ({ label: item.label, value: item[areaField] })), '#55b58f', 4);
    bars('cali-kinship-chart', current.kinship, '#7b61c9', 12);
    bars('cali-area-chart', data.areas.map(item => ({ label: item.label, value: item[areaField] })), '#4f86ed', 15);
    donut('cali-tenure-chart', current.tenure, palettes.tenure);
    bars('cali-property-chart', current.property, '#55a790', 9);
  }

  /* Bloques que no dependen del alcance: cobertura, cruce,
     evaluaciones y trazabilidad de fuentes. */
  function renderContext() {
    const data = C();
    const coverage = data.coverage;

    $('cali-coverage-list').innerHTML = [
      ['Direcciones informadas', `${fmt.format(coverage.addressRecords)} · ${coverage.addressCoveragePct.toFixed(1)}%`],
      ['Direcciones únicas', fmt.format(coverage.uniqueAddresses)],
      ['Área territorial informada', `${fmt.format(coverage.sectorRecords)} · ${coverage.sectorCoveragePct.toFixed(1)}%`],
      ['RUD asociado a puntos', `${fmt.format(data.match.matchedRecords)} · ${data.match.matchedPct.toFixed(1)}%`],
    ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');

    /* Se arma desde los contadores de confianza y no desde
       `match.methods`: ese array es redundante y puede quedar
       desfasado en el export (en el lote 2026-09-01 traia 612 en
       "Alta" cuando highRecords ya iba en 9.579). highRecords +
       mediumRecords + unmatchedRecords si cuadra con rudRecords,
       y es la misma fuente que leen los KPIs. */
    donut('cali-match-chart', [
      { label: 'Alta · dirección normalizada', value: data.match.highRecords },
      { label: 'Media · nomenclatura + área', value: data.match.mediumRecords },
      { label: 'Sin coincidencia', value: data.match.unmatchedRecords },
    ], palettes.match);
    donut('cali-citizen-chart', [
      { label: 'En RUD Cali', value: data.citizens.matchedRudCali },
      { label: 'Sin coincidencia', value: data.citizens.unmatchedRudCali },
    ], palettes.citizens);
    bars('cali-damage-chart', data.evaluations.damage, palettes.severity, 8);
    bars('cali-severity-chart', data.evaluations.severity, palettes.severityAlt, 8);

    $('evaluation-tag').textContent = `Paso 1: ${fmt.format(data.sources.step1)} · Paso 2: ${fmt.format(data.sources.step2)}`;
    $('citizen-tag').textContent = `${fmt.format(data.citizens.total)} ciudadanos`;

    const sourceRows = [
      ['RUD Cali', data.sources.rudRecords, 'Personas, hogares y bienes'],
      ['Reportes ciudadanos', data.sources.citizenReports, 'Direcciones y puntos reportados'],
      ['Evaluación paso 1', data.sources.step1, 'Preclasificación de visita'],
      ['Evaluación paso 2', data.sources.step2, 'Visitas con coordenadas'],
      ['Evaluaciones estructurales', data.sources.structuralEvaluations, 'Daño, severidad y habitabilidad'],
      ['Lugares canónicos', data.sources.places, 'Referencia geográfica'],
    ];
    $('cali-source-table').innerHTML = sourceRows
      .map(row => `<tr><td>${row[0]}</td><td>${fmt.format(row[1])}</td><td>${row[2]}</td></tr>`)
      .join('');

    renderCitizens();
  }

  /* Tabla de conciliación. Muestra como máximo 300 filas: es una
     herramienta de consulta puntual, no un listado exhaustivo. */
  function renderCitizens() {
    const status = $('citizen-status-filter')?.value || 'ALL';
    const query = normalizedText($('citizen-search')?.value);
    const rows = (C().citizens.details || []).filter(item => {
      const matched = item.status === 'En RUD Cali';
      const statusOk = status === 'ALL' || (status === 'MATCHED' ? matched : !matched);
      const text = normalizedText(`${item.protectedId} ${item.maskedDocument}`);
      return statusOk && (!query || text.includes(query));
    }).slice(0, 300);

    $('citizen-detail-table').innerHTML = rows.length
      ? rows.map(item => `<tr><td>${item.protectedId}</td><td>${item.maskedDocument}</td><td><span class="status-pill ${item.status === 'En RUD Cali' ? 'matched' : 'unmatched'}">${item.status}</span></td><td>${fmt.format(item.rudRecords)}</td></tr>`).join('')
      : '<tr><td colspan="4">No hay registros para el filtro seleccionado.</td></tr>';
  }

  /* --- Ciclo de render --------------------------------------- */

  function render() {
    renderAreaHint();
    const current = scope();
    renderKpis(current);
    renderCharts(current);
    renderContext();
    if (window.L) {
      DASH.caliMap.ensure();
      DASH.caliMap.invalidate();
    }
    DASH.caliMap.update();
  }

  function init() {
    /* Índice de áreas para resolver lo que se escriba en el combobox. */
    filters.areaIndex = new Map(C().areas.map(item => [normalizedText(item.label), item.label]));
    renderList();

    document.querySelectorAll('.mode-btn').forEach(button => {
      button.addEventListener('click', () => {
        filters.mode = button.dataset.mode;
        document.querySelectorAll('.mode-btn').forEach(item => item.classList.toggle('active', item === button));
        render();
      });
    });

    /* Alcance: reindexa todo el tablero. */
    $('cali-zone-filter').addEventListener('change', () => {
      pruneAreaForZone();
      renderList();
      render();
    });

    initCombo();

    /* Capa del mapa: solo repinta los puntos. */
    ['cali-damage-filter', 'cali-search'].forEach(id => {
      ['input', 'change'].forEach(event => $(id).addEventListener(event, () => DASH.caliMap.update()));
    });

    ['citizen-status-filter', 'citizen-search'].forEach(id => {
      ['input', 'change'].forEach(event => $(id).addEventListener(event, renderCitizens));
    });
  }

  /* Cableado del combobox: apertura, teclado y selección. El clic
     se captura en mousedown para que llegue antes que el blur. */
  function initCombo() {
    const input = $('cali-area-filter');
    const list = $('cali-area-list');
    const toggle = $('cali-area-toggle');

    input.addEventListener('focus', openCombo);
    input.addEventListener('click', openCombo);

    input.addEventListener('input', () => {
      activeIndex = -1;
      openCombo();
      renderList();
      render();
    });

    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(-1); }
      else if (event.key === 'Enter') {
        event.preventDefault();
        selectArea(activeIndex >= 0 ? pool[activeIndex]?.label : input.value);
      } else if (event.key === 'Escape') closeCombo();
    });

    /* El blur se retrasa un poco para no cancelar un clic en curso. */
    input.addEventListener('blur', () => setTimeout(closeCombo, 120));

    toggle.addEventListener('mousedown', event => {
      event.preventDefault();
      if (list.hidden) { input.focus(); openCombo(); } else closeCombo();
    });

    /* Delegación: una sola escucha para las 200 filas. */
    list.addEventListener('mousedown', event => {
      const option = event.target.closest('.combo-option');
      if (!option) return;
      event.preventDefault();
      const index = Number(option.dataset.index);
      selectArea(index >= 0 ? pool[index]?.label : '');
    });
  }

  DASH.cali = { init, render, renderCitizens, renderList, selectArea };
})();

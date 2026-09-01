/* ============================================================
   filters.js · estado compartido de los controles de Cali.

   Dos grupos con alcances distintos, y la distinción es real:
   - Alcance (zona, área): reindexa KPIs, gráficos y tablas usando
     los agregados precalculados de `views`.
   - Capa del mapa (daño, búsqueda): solo filtra los puntos. Los
     agregados del RUD no tienen dimensión de daño estructural
     -el daño vive en las evaluaciones, que cruzan con el 10,8%
     de los registros-, así que no se puede reindexar el tablero
     por ese eje sin regenerar el pipeline.
   ============================================================ */

window.DASH = window.DASH || {};

(() => {
  const { $, normalizedText } = DASH.utils;

  DASH.filters = {
    /* 'rud' | 'crossed' | 'citizens' */
    mode: 'rud',

    /* Texto normalizado -> etiqueta canónica del área.
       Lo llena DASH.cali.init() a partir de CALI_DATA.areas. */
    areaIndex: new Map(),

    zone: () => $('cali-zone-filter')?.value || 'ALL',

    /* El campo de área es un combobox de texto libre: solo cuenta
       si lo escrito resuelve a un área conocida. */
    area() {
      const raw = ($('cali-area-filter')?.value || '').trim();
      if (!raw) return 'ALL';
      return this.areaIndex.get(normalizedText(raw)) || 'ALL';
    },

    /* True si el usuario escribió algo que no corresponde a
       ningún área: sirve para avisarle en lugar de ignorarlo. */
    areaIsUnknown() {
      const raw = ($('cali-area-filter')?.value || '').trim();
      return Boolean(raw) && !this.areaIndex.has(normalizedText(raw));
    },

    damage: () => $('cali-damage-filter')?.value || 'ALL',
    search: () => $('cali-search')?.value || '',

    /* True si el alcance está acotado a una zona o a un área. */
    hasTerritory() {
      return this.area() !== 'ALL' || this.zone() !== 'ALL';
    },
  };
})();

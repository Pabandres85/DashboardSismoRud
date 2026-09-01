/* ============================================================
   utils.js - helpers de DOM, formato y saneamiento de texto
   ============================================================ */

window.DASH = window.DASH || {};

(() => {
  const fmt = new Intl.NumberFormat('es-CO');

  const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  };

  /* Rango de marcas diacriticas combinantes (Unicode Mn). */
  const COMBINING_MARKS = /[\u0300-\u036f]/g;

  DASH.utils = {
    /* Atajo de document.getElementById. */
    $: id => document.getElementById(id),

    /* Formateador de miles en espanol de Colombia. */
    fmt,

    /* Porcentaje con un decimal; devuelve '0.0%' si el denominador es 0. */
    pct: (n, d) => (d ? `${(n / d * 100).toFixed(1)}%` : '0.0%'),

    /* Minusculas sin tildes, para busquedas insensibles a acentos. */
    normalizedText(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(COMBINING_MARKS, '')
        .toLowerCase();
    },

    /* Escapa texto antes de inyectarlo en innerHTML o en un popup. */
    escapeHtml(value) {
      return String(value || '').replace(/[&<>'"]/g, char => HTML_ESCAPES[char]);
    },
  };
})();

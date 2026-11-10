// Idioma del sitio (español / inglés).
//
// El HTML de cada página está escrito en español. Si la persona elige inglés, este archivo cambia los
// textos en el navegador usando el diccionario window.HV_EN = { 'texto en español': 'English text' }
// (js/i18n-en.js y, en el inicio, js/i18n-en-changelog.js) — la misma idea que usa la app
// (F:\HAVORA\core\locales\en.js, claves en español).
//
// Cómo se elige el idioma, en este orden:
//   1. ?lang=en / ?lang=es en la dirección (sirve para compartir un enlace en inglés),
//   2. lo que la persona eligió antes con el selector ES/EN (localStorage 'hv-lang'),
//   3. el idioma del navegador: español si empieza por «es», inglés en cualquier otro caso.
//
// Qué se traduce:
//   - un elemento cuyo contenido es solo texto + etiquetas de línea (<em>, <strong>, <a>, <br>…) se
//     busca entero por su innerHTML (espacios colapsados), así una frase con <em> se traduce de una vez;
//   - si no está, se baja a sus hijos y cada texto suelto se busca por su texto;
//   - los atributos alt, title, aria-label, placeholder y el content de las <meta> de descripción;
//   - <title>.
// Un texto que no está en el diccionario queda en español (nunca se rompe nada).
// Para ver qué falta en una página: abrirla con ?lang=en&i18nDebug=1 y mirar la consola.
//
// Textos que arma el JavaScript de la página: usar hvT('texto en español', {n: 3}) — devuelve el
// texto en el idioma actual, con {variables} reemplazadas.
//
// Al agregar texto nuevo al sitio (por ejemplo una versión nueva en las Novedades), sumar su
// traducción al diccionario; si no, ese texto se ve en español también en la versión en inglés.
(function () {
  'use strict';

  var INLINE = { A: 1, EM: 1, STRONG: 1, B: 1, I: 1, S: 1, BR: 1, SPAN: 1, CODE: 1, KBD: 1, SMALL: 1, SUP: 1, SUB: 1, U: 1, MARK: 1, ABBR: 1, TIME: 1 };
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, SVG: 1, svg: 1, VIDEO: 1, TEXTAREA: 1, CODE: 1 };
  var ATTRS = ['alt', 'title', 'aria-label', 'placeholder'];
  var MONTHS = { enero: 'January', febrero: 'February', marzo: 'March', abril: 'April', mayo: 'May', junio: 'June', julio: 'July', agosto: 'August', septiembre: 'September', setiembre: 'September', octubre: 'October', noviembre: 'November', diciembre: 'December' };

  // Reglas para textos con números (fechas, cantidades), que no conviene listar uno por uno.
  var RULES = [
    [/^(\d{1,2}) de ([a-záéíóú]+) de (\d{4})$/i, function (m) { return MONTHS[m[2].toLowerCase()] ? MONTHS[m[2].toLowerCase()] + ' ' + m[1] + ', ' + m[3] : null; }],
    [/^Última actualización: (\d{1,2}) de ([a-záéíóú]+) de (\d{4})$/i, function (m) { return MONTHS[m[2].toLowerCase()] ? 'Last updated: ' + MONTHS[m[2].toLowerCase()] + ' ' + m[1] + ', ' + m[3] : null; }],
    [/^(\d+) min de lectura$/, function (m) { return m[1] + ' min read'; }],
    [/^v\d+(\.\d+)+$/, function (m) { return m[0]; }],
  ];

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  function hasLetters(s) { return /[a-záéíóúñü¿¡]/i.test(s); }

  function lookup(dict, key) {
    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    for (var i = 0; i < RULES.length; i++) {
      var m = key.match(RULES[i][0]);
      if (m) { var r = RULES[i][1](m); if (r != null) return r; }
    }
    return null;
  }

  function isInlineOnly(el) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) continue;
      if (c.nodeType === 8) continue;
      if (c.nodeType !== 1) return false;
      if (!INLINE[c.tagName]) return false;
      if (!isInlineOnly(c)) return false;
    }
    return true;
  }

  // Tiene texto propio (no solo dentro de un hijo): si no, se baja al hijo, que es la frase real.
  function hasOwnText(el) {
    for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && hasLetters(c.nodeValue)) return true;
    return false;
  }

  function skipped(el) {
    return SKIP[el.tagName] || (el.hasAttribute && (el.hasAttribute('data-i18n-skip') || el.hasAttribute('data-i18n-es-only')));
  }

  // Recorre el documento; para cada texto llama visit(tipo, clave, aplicar).
  function walk(root, visit) {
    (function rec(el) {
      if (skipped(el)) return;
      for (var a = 0; a < ATTRS.length; a++) {
        var v = el.getAttribute && el.getAttribute(ATTRS[a]);
        if (v && hasLetters(v)) (function (name, val) {
          visit('attr', norm(val), function (t) { el.setAttribute(name, t); });
        })(ATTRS[a], v);
      }
      if (el !== root && el.tagName !== 'BODY' && isInlineOnly(el) && hasOwnText(el)) {
        var key = norm(el.innerHTML);
        if (hasLetters(key)) {
          var done = visit('html', key, function (t) { el.innerHTML = t; });
          if (done) return;
        }
      }
      for (var c = el.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 1) rec(c);
        else if (c.nodeType === 3 && hasLetters(c.nodeValue)) (function (node) {
          var raw = node.nodeValue, k = norm(raw);
          if (!k) return;
          visit('text', k, function (t) {
            var lead = /^\s/.test(raw) ? ' ' : '', trail = /\s$/.test(raw) ? ' ' : '';
            node.nodeValue = lead + t + trail;
          });
        })(c);
      }
    })(root);
  }

  function metaNodes(doc) {
    return doc.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"]');
  }

  // Lista de claves de una página (lo usa la herramienta que arma el diccionario).
  // Un elemento de solo-línea cuenta como una clave entera (no se baja a sus hijos).
  function collect(doc) {
    var seen = {}, out = [];
    function add(k) { if (!seen[k] && hasLetters(k) && !lookup({}, k)) { seen[k] = 1; out.push(k); } }
    if (doc.title) add(norm(doc.title));
    var metas = metaNodes(doc);
    for (var i = 0; i < metas.length; i++) add(norm(metas[i].getAttribute('content') || ''));
    walk(doc.body, function (type, key) { add(key); return true; });
    return out;
  }

  var missing = [];
  function apply(doc, dict) {
    var t = doc.title && lookup(dict, norm(doc.title));
    if (t) doc.title = t;
    var metas = metaNodes(doc);
    for (var i = 0; i < metas.length; i++) {
      var m = lookup(dict, norm(metas[i].getAttribute('content') || ''));
      if (m) metas[i].setAttribute('content', m);
    }
    walk(doc.body, function (type, key, set) {
      var v = lookup(dict, key);
      if (v != null) { set(v); return true; }
      if (type !== 'html') missing.push(key);
      return false;
    });
  }

  window.HVI18N = { collect: collect, apply: apply, lookup: lookup, norm: norm, missing: missing };
  if (window.__HVI18N_NOBOOT) return;

  // ── Idioma elegido ──
  var params = new URLSearchParams(location.search);
  var fromUrl = params.get('lang');
  var stored = null;
  try { stored = localStorage.getItem('hv-lang'); } catch (e) {}
  var browser = ((navigator.languages && navigator.languages[0]) || navigator.language || 'es').toLowerCase().indexOf('es') === 0 ? 'es' : 'en';
  var lang = (fromUrl === 'en' || fromUrl === 'es') ? fromUrl : (stored === 'en' || stored === 'es') ? stored : browser;
  if (fromUrl === 'en' || fromUrl === 'es') { try { localStorage.setItem('hv-lang', fromUrl); } catch (e) {} }

  var dict = window.HV_EN || {};
  window.HV_LANG = lang;
  window.hvT = function (s, vars) {
    var out = lang === 'en' ? (lookup(dict, s) || s) : s;
    if (vars) out = out.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return out;
  };

  document.documentElement.lang = lang;
  if (lang === 'en') {
    apply(document, dict);
    // Bloques sin traducción (p. ej. las Novedades anteriores a la 4.0): se ocultan detrás de un aviso
    // con un botón para verlos igual, en español.
    var esOnly = document.querySelectorAll('[data-i18n-es-only]');
    for (var e = 0; e < esOnly.length; e++) { esOnly[e].setAttribute('lang', 'es'); esOnly[e].hidden = true; }
    // Imágenes con texto que tienen su versión en inglés (p. ej. la insignia oficial de Microsoft
    // Store): <img src="…es.svg" data-src-en="…en.svg">. El alt se traduce con el diccionario.
    var imgs = document.querySelectorAll('img[data-src-en]');
    for (var g = 0; g < imgs.length; g++) imgs[g].setAttribute('src', imgs[g].getAttribute('data-src-en'));
    // Avisos que solo tienen sentido en inglés (p. ej. «esta traducción es de referencia»).
    var enOnly = document.querySelectorAll('[data-i18n-en-only]');
    for (var q = 0; q < enOnly.length; q++) enOnly[q].hidden = false;
    var notes = document.querySelectorAll('[data-i18n-es-only-note]');
    for (var n = 0; n < notes.length; n++) (function (note) {
      note.hidden = false;
      var b = note.querySelector('button');
      if (b) b.addEventListener('click', function () {
        for (var j = 0; j < esOnly.length; j++) esOnly[j].hidden = false;
        note.hidden = true;
      });
    })(notes[n]);
    if (params.get('i18nDebug') && window.console) console.log('[i18n] sin traducir:', missing);
  }

  // Si la elección no quedó guardada (navegador sin localStorage), los enlaces a otras páginas del
  // sitio llevan ?lang= para no volver al idioma del navegador.
  if (lang !== browser) {
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (!/^(https?:|mailto:|#|\/\/)/.test(href) && /\.html(#.*)?$/.test(href)) {
        var parts = href.split('#');
        links[i].setAttribute('href', parts[0] + (parts[0].indexOf('?') < 0 ? '?' : '&') + 'lang=' + lang + (parts[1] ? '#' + parts[1] : ''));
      }
    }
  }

  // ── Selector ES / EN ──
  var css = '.lang-switch{display:inline-flex;align-items:center;border:1px solid var(--border,#e2e0ef);border-radius:999px;padding:2px;gap:2px;flex-shrink:0;background:var(--bg2,#fff)}' +
    '.lang-switch button{font:600 .72rem/1 var(--sans,system-ui,sans-serif);letter-spacing:.04em;border:0;background:transparent;color:var(--muted,#7a788f);padding:6px 8px;border-radius:999px;cursor:pointer}' +
    '.lang-switch button:hover{color:var(--text,#1a1832)}' +
    '.lang-switch button[aria-pressed="true"]{background:var(--accent,#5c6bc0);color:#fff}' +
    '.lang-switch button:focus-visible{outline:2px solid var(--accent,#5c6bc0);outline-offset:1px}' +
    // En la barra oscura de arriba (y en el panel oscuro del pago)
    'nav .lang-switch,.lang-switch.on-dark{background:transparent;border-color:rgba(255,255,255,.16)}' +
    'nav .btn-nav-back{white-space:nowrap}' +
    'nav .lang-switch button,.lang-switch.on-dark button{color:rgba(255,255,255,.6)}' +
    'nav .lang-switch button:hover,.lang-switch.on-dark button:hover{color:#fff}' +
    'nav .lang-switch button[aria-pressed="true"],.lang-switch.on-dark button[aria-pressed="true"]{background:rgba(255,255,255,.14);color:#fff}' +
    '[data-i18n-es-only-note]{font-size:.85rem;color:var(--muted,#7a788f);margin:0 0 28px}' +
    '[data-i18n-es-only-note] button{font:inherit;font-weight:600;color:var(--accent,#5c6bc0);background:none;border:0;padding:0;margin-left:4px;cursor:pointer;text-decoration:underline}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  function setLang(l) {
    if (l === lang) return;
    try { localStorage.setItem('hv-lang', l); } catch (e) {}
    var p = new URLSearchParams(location.search);
    p.set('lang', l);
    location.replace(location.pathname + '?' + p.toString() + location.hash);
  }

  var slots = document.querySelectorAll('[data-lang-switch]');
  for (var s = 0; s < slots.length; s++) {
    var wrap = document.createElement('div');
    wrap.className = 'lang-switch' + (slots[s].getAttribute('data-lang-switch') === 'dark' ? ' on-dark' : '');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', lang === 'en' ? 'Language' : 'Idioma');
    [['es', 'ES', 'Español'], ['en', 'EN', 'English']].forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = o[1];
      b.title = o[2];
      b.setAttribute('lang', o[0]);
      b.setAttribute('aria-pressed', String(o[0] === lang));
      b.addEventListener('click', function () { setLang(o[0]); });
      wrap.appendChild(b);
    });
    slots[s].appendChild(wrap);
  }
})();

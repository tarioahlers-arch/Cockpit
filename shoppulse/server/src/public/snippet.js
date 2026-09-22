/*!
 * ShopPulse Tracking- & Nudge-Snippet
 *
 * Einbindung:
 *   <script src="https://<shoppulse-host>/snippet.js" data-key="pk_..." async></script>
 *
 * Datenschutz: Vor einer Einwilligung wird NICHTS gespeichert oder gesendet und kein Nudge
 * ausgespielt. Einwilligung per ShopPulse.consent(true) (z. B. aus dem Consent-Banner),
 * per data-consent="granted" am Script-Tag oder per Event "shoppulse:consent".
 *
 * Seiten-Annotation (Attribute an <body> oder einem Container mit [data-sp-page]):
 *   data-sp-page="home|category|product|cart|checkout|confirmation|other"
 *   data-sp-sku, data-sp-price, data-sp-reference-price, data-sp-stock
 *   data-sp-order-value, data-sp-order-skus="SKU1,SKU2" (auf der Bestellbestaetigung)
 * Elemente:
 *   [data-sp-add-to-cart]    Kauf-Button (Zoegern + Klick werden gemessen)
 *   [data-sp-price-filter]   Preisfilter/-sortierung
 *   [data-sp-nudge-slot]     optionaler Platz fuer Nudges (sonst vor dem Kauf-Button)
 *   [data-sp-variant-sku]    Varianten-/Paketoption (fuer Decoy-Tests)
 */
(function () {
  'use strict';
  if (window.ShopPulse && window.ShopPulse.__loaded) return;

  var script =
    document.currentScript ||
    document.querySelector('script[data-key][src*="snippet.js"]');
  var KEY = script && script.getAttribute('data-key');
  var ENDPOINT = script ? new URL(script.src, location.href).origin : '';
  var STORAGE_VISITOR = 'shoppulse_vid';
  var STORAGE_SESSION = 'shoppulse_sid';
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  var HESITATION_MS = 2000;

  var consent = script && script.getAttribute('data-consent') === 'granted';
  var queue = [];
  var visitorId = null;
  var sessionId = null;
  var started = false;
  var exposedThisPage = {};

  function randomId() {
    var a = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function ids() {
    try {
      visitorId = localStorage.getItem(STORAGE_VISITOR);
      if (!visitorId) {
        visitorId = randomId();
        localStorage.setItem(STORAGE_VISITOR, visitorId);
      }
      var raw = sessionStorage.getItem(STORAGE_SESSION);
      var s = raw ? JSON.parse(raw) : null;
      if (!s || Date.now() - s.t > SESSION_TIMEOUT_MS) s = { id: randomId(), t: Date.now() };
      s.t = Date.now();
      sessionStorage.setItem(STORAGE_SESSION, JSON.stringify(s));
      sessionId = s.id;
    } catch (e) {
      // Speicher blockiert: fluechtige IDs nur fuer diese Seite
      visitorId = visitorId || randomId();
      sessionId = sessionId || randomId();
    }
  }

  function pageData() {
    var el = document.querySelector('[data-sp-page]') || document.body;
    var d = el ? el.dataset : {};
    var n = function (v) { var x = parseFloat(String(v || '').replace(',', '.')); return isFinite(x) ? x : null; };
    return {
      pageType: d.spPage || 'other',
      sku: d.spSku || null,
      price: n(d.spPrice),
      referencePrice: n(d.spReferencePrice),
      stock: d.spStock != null && d.spStock !== '' ? parseInt(d.spStock, 10) : null,
      orderValue: n(d.spOrderValue),
      orderSkus: d.spOrderSkus ? d.spOrderSkus.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : null,
    };
  }

  function track(type, props) {
    if (!consent) return;
    var p = props || {};
    var page = pageData();
    queue.push({
      type: type,
      pageType: p.pageType || page.pageType,
      sku: p.sku !== undefined ? p.sku : page.sku,
      value: typeof p.value === 'number' ? p.value : undefined,
      skus: p.skus,
      experimentId: p.experimentId,
      variant: p.variant,
    });
    if (queue.length >= 10 || type === 'purchase' || type === 'add_to_cart') flush();
  }

  function flush(useBeacon) {
    if (!consent || !queue.length || !KEY) return;
    var payload = JSON.stringify({ key: KEY, visitorId: visitorId, sessionId: sessionId, events: queue.splice(0, 50) });
    var url = ENDPOINT + '/api/collect';
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: 'text/plain' }));
    } else {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true })
        .catch(function () {});
    }
  }

  // --- Mikro-Interaktionen -------------------------------------------------

  function watchScroll() {
    var maxDepth = 0;
    var reported = 0;
    window.addEventListener('scroll', function () {
      var h = document.documentElement;
      var depth = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / h.scrollHeight) * 100));
      if (depth > maxDepth) maxDepth = depth;
    }, { passive: true });
    function report() {
      if (maxDepth > reported) {
        reported = maxDepth;
        track('scroll_depth', { value: maxDepth });
      }
      flush(true);
    }
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') report(); });
    window.addEventListener('pagehide', report);
  }

  function watchButtons() {
    var buttons = document.querySelectorAll('[data-sp-add-to-cart]');
    Array.prototype.forEach.call(buttons, function (btn) {
      var enter = 0;
      var clicked = false;
      btn.addEventListener('mouseenter', function () { enter = Date.now(); clicked = false; });
      btn.addEventListener('mouseleave', function () {
        var dwell = Date.now() - enter;
        if (enter && !clicked && dwell >= HESITATION_MS) track('hesitation', { value: dwell });
        enter = 0;
      });
      btn.addEventListener('click', function () {
        clicked = true;
        track('add_to_cart', { sku: btn.getAttribute('data-sp-sku') || undefined });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-sp-price-filter]'), function (el) {
      el.addEventListener('change', function () { track('price_filter'); });
      el.addEventListener('click', function () { if (el.tagName !== 'SELECT' && el.tagName !== 'INPUT') track('price_filter'); });
    });
  }

  // --- Nudges -------------------------------------------------------------

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295;
  }

  function fill(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
  }

  function slot() {
    var s = document.querySelector('[data-sp-nudge-slot]');
    if (s) return s;
    var btn = document.querySelector('[data-sp-add-to-cart]');
    if (!btn || !btn.parentNode) return null;
    s = document.createElement('div');
    s.setAttribute('data-sp-nudge-slot', '');
    btn.parentNode.insertBefore(s, btn);
    return s;
  }

  function badge(text, kind) {
    var el = document.createElement('div');
    el.className = 'sp-nudge sp-nudge-' + kind;
    el.textContent = text;
    el.style.cssText =
      'margin:8px 0;padding:6px 10px;border-radius:6px;font:600 13px/1.4 system-ui,sans-serif;' +
      'background:#eef4ff;color:#1d3a8a;border:1px solid #c9d8ff;display:inline-block;';
    return el;
  }

  /** Gibt ein DOM-Element zurueck oder null, wenn ehrlich nichts gezeigt werden kann. */
  function renderNudge(exp, page) {
    var c = exp.config || {};
    var d = exp.data || {};
    switch (exp.type) {
      case 'anchoring': {
        if (page.referencePrice == null || page.price == null || page.referencePrice <= page.price) return null;
        var saving = Math.round((1 - page.price / page.referencePrice) * 100);
        return badge(fill(c.template, {
          reference: page.referencePrice.toFixed(2).replace('.', ','),
          savingPct: saving,
        }), 'anchoring');
      }
      case 'social_proof':
        if (!d.show) return null;
        return badge(fill(c.template, { count: d.count, hours: d.hours }), 'social-proof');
      case 'scarcity': {
        var stock = d.stock != null ? d.stock : page.stock;
        if (stock == null || stock <= 0 || stock > (Number(c.maxStock) || 10)) return null;
        return badge(fill(c.template, { stock: stock }), 'scarcity');
      }
      case 'decoy':
        return null; // wird direkt an der Zielvariante gerendert, siehe unten
    }
    return null;
  }

  function applyExperiments(experiments) {
    var page = pageData();
    experiments.forEach(function (exp) {
      var variant = hash(visitorId + ':' + exp.id) < exp.split ? 'treatment' : 'control';
      if (!exposedThisPage[exp.id]) {
        exposedThisPage[exp.id] = true;
        track('exposure', { experimentId: exp.id, variant: variant });
      }
      if (variant !== 'treatment') return;
      if (exp.type === 'decoy') {
        if (!exp.data || !exp.data.show) return;
        var target = document.querySelector('[data-sp-variant-sku="' + String(exp.config.targetSku).replace(/"/g, '') + '"]');
        if (target) target.insertBefore(badge(exp.config.badge || 'Beliebteste Wahl', 'decoy'), target.firstChild);
        return;
      }
      var el = renderNudge(exp, page);
      var s = el && slot();
      if (s) s.appendChild(el);
    });
    flush();
  }

  function loadExperiments() {
    var page = pageData();
    var qs = '?key=' + encodeURIComponent(KEY) + '&pageType=' + encodeURIComponent(page.pageType) +
      (page.sku ? '&sku=' + encodeURIComponent(page.sku) : '');
    fetch(ENDPOINT + '/api/public/config' + qs)
      .then(function (r) { return r.ok ? r.json() : { experiments: [] }; })
      .then(function (cfg) { applyExperiments(cfg.experiments || []); })
      .catch(function () {});
  }

  // --- Start --------------------------------------------------------------

  function start() {
    if (started || !consent || !KEY) return;
    started = true;
    ids();
    var page = pageData();
    track('page_view');
    if (page.pageType === 'checkout') track('checkout_start');
    if (page.pageType === 'confirmation' && page.orderValue != null) {
      track('purchase', { value: page.orderValue, skus: page.orderSkus || undefined });
    }
    watchScroll();
    watchButtons();
    loadExperiments();
    setInterval(function () { flush(); }, 5000);
  }

  window.ShopPulse = {
    __loaded: true,
    consent: function (granted) {
      consent = !!granted;
      if (!consent) {
        queue = [];
        try { localStorage.removeItem(STORAGE_VISITOR); sessionStorage.removeItem(STORAGE_SESSION); } catch (e) {}
        return;
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
      else start();
    },
    /** Manuelles Tracking, z. B. ShopPulse.track('purchase', { value: 59.9, skus: ['A1'] }) */
    track: function (type, props) { track(type, props); },
  };

  document.addEventListener('shoppulse:consent', function (e) {
    window.ShopPulse.consent(!e.detail || e.detail.granted !== false);
  });
  if (consent) window.ShopPulse.consent(true);
})();

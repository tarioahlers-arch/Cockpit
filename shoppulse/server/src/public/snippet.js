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
 *   [data-sp-availability]   Verfuegbarkeitsanzeige (Wert = SKU, leer = SKU der Seite)
 *   [data-sp-availability-sku="SKU"]  Verfuegbarkeit z. B. in Kategorie-Listings
 *   [data-sp-private]        Bereich wird von der Klick-Analyse ignoriert (z. B. Kundenkonto)
 *
 * Klick-Analyse: Klicks (max. 60 je Seite), Frust-Klicks, Klicks ins Leere und hektisches Scrollen –
 * ohne Texteingaben/Formularwerte. Heatmap-Ansicht: Seite mit ?sp_heatmap=<Token aus dem Dashboard>.
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
    var ev = {
      type: type,
      pageType: p.pageType || page.pageType,
      sku: p.sku !== undefined ? p.sku : page.sku,
      value: typeof p.value === 'number' ? p.value : undefined,
      skus: p.skus,
      experimentId: p.experimentId,
      variant: p.variant,
    };
    if (p.click) for (var k in p.click) ev[k] = p.click[k];
    queue.push(ev);
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
    // Hektisches Scrollen: >= 4 Richtungswechsel (je >= 150 px) innerhalb von 2,5 s
    var lastY = window.scrollY, dir = 0, anchorY = window.scrollY, flips = [], thrashLock = 0;
    window.addEventListener('scroll', function () {
      var h = document.documentElement;
      var depth = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / h.scrollHeight) * 100));
      if (depth > maxDepth) maxDepth = depth;
      var y = window.scrollY;
      var d = y > lastY ? 1 : y < lastY ? -1 : 0;
      if (d && d !== dir) {
        if (dir && Math.abs(lastY - anchorY) >= 150) flips.push(Date.now());
        dir = d;
        anchorY = lastY;
      }
      lastY = y;
      var now = Date.now();
      flips = flips.filter(function (t) { return now - t < 2500; });
      if (flips.length >= 4 && now > thrashLock) {
        track('scroll_thrash');
        thrashLock = now + 10000;
        flips = [];
      }
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
        // Liefert der Server einen (integrierten) Bestand – auch null = "reichlich" –, hat er Vorrang
        var stock = 'stock' in d ? d.stock : page.stock;
        if (stock == null || stock <= 0 || stock > (Number(c.maxStock) || 10)) return null;
        return badge(fill(c.template, { stock: stock }), 'scarcity');
      }
      case 'decoy':
        return null; // wird direkt an der Zielvariante gerendert, siehe unten
    }
    return null;
  }

  var GROUP_FLAG = 'shoppulse_group_sent';

  /** Dauerhafte Kontrollgruppe (Uplift-Nachweis): stabil je Besucher:in, sieht nie Nudges. */
  function assignGroup(holdoutShare) {
    if (!holdoutShare) return 'exposed';
    var group = hash(visitorId + ':holdout') < holdoutShare ? 'holdout' : 'exposed';
    var sent = null;
    try { sent = sessionStorage.getItem(GROUP_FLAG); } catch (e) {}
    if (sent !== sessionId) {
      track('group', { variant: group });
      try { sessionStorage.setItem(GROUP_FLAG, sessionId); } catch (e) {}
    }
    return group;
  }

  function renderInto(exp, page) {
    if (exp.type === 'decoy') {
      if (!exp.data || !exp.data.show) return;
      var target = document.querySelector('[data-sp-variant-sku="' + String(exp.config.targetSku).replace(/"/g, '') + '"]');
      if (target) target.insertBefore(badge(exp.config.badge || 'Beliebteste Wahl', 'decoy'), target.firstChild);
      return;
    }
    var el = renderNudge(exp, page);
    var s = el && slot();
    if (s) s.appendChild(el);
  }

  function applyConfig(cfg) {
    var page = pageData();
    if (assignGroup(cfg.holdoutShare || 0) === 'holdout') {
      flush();
      return; // Kontrollgruppe: keine Tests, keine ausgerollten Nudges
    }
    // Ausgerollte Gewinner gelten fuer alle uebrigen Besucher:innen
    var segment = cfg.segment || 'undetermined';
    // Segment-Targeting: nur Nudges, die fuer das Segment dieser Besucherin/dieses Besuchers gelten
    var eligible = function (item) { return !item.segments || item.segments.indexOf(segment) !== -1; };
    (cfg.rollouts || []).filter(eligible).forEach(function (r) { renderInto(r, page); });
    applyExperiments((cfg.experiments || []).filter(eligible));
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
      renderInto(exp, page);
    });
    flush();
  }

  function loadExperiments() {
    var page = pageData();
    var qs = '?key=' + encodeURIComponent(KEY) + '&pageType=' + encodeURIComponent(page.pageType) +
      (page.sku ? '&sku=' + encodeURIComponent(page.sku) : '') + '&visitor=' + encodeURIComponent(visitorId);
    fetch(ENDPOINT + '/api/public/config' + qs)
      .then(function (r) { return r.ok ? r.json() : { experiments: [] }; })
      .then(function (cfg) { applyConfig(cfg); })
      .catch(function () {});
  }

  // --- Verfuegbarkeit (Lagerbestand fuer Kund:innen) ------------------------
  // Reine Anzeige ohne IDs, Speicher oder Tracking – laeuft daher auch ohne Einwilligung.

  var AV_COLORS = { in_stock: '#1a7f4b', low_stock: '#b26a00', out_of_stock: '#b3261e' };

  function renderAvailability(el, a) {
    if (!a || a.status === 'unknown' || !a.label) return;
    el.innerHTML = '';
    var line = document.createElement('div');
    line.className = 'sp-availability sp-availability-' + a.status;
    line.style.cssText = 'font:600 14px/1.4 system-ui,sans-serif;display:flex;align-items:center;gap:6px;color:' + (AV_COLORS[a.status] || '#333');
    var dot = document.createElement('span');
    dot.style.cssText = 'width:9px;height:9px;border-radius:50%;flex:none;background:' + (AV_COLORS[a.status] || '#999');
    line.appendChild(dot);
    line.appendChild(document.createTextNode(a.label));
    el.appendChild(line);
    if (a.stores && a.stores.length && el.getAttribute('data-sp-show-stores') !== 'false') {
      var list = document.createElement('ul');
      list.className = 'sp-availability-stores';
      list.style.cssText = 'margin:4px 0 0;padding-left:18px;font:13px/1.5 system-ui,sans-serif;color:#555';
      a.stores.forEach(function (s) {
        var li = document.createElement('li');
        li.textContent = s.name + ': ' + s.label;
        list.appendChild(li);
      });
      el.appendChild(list);
    }
  }

  function loadAvailability() {
    if (!KEY) return;
    var page = pageData();
    var targets = [];
    Array.prototype.forEach.call(document.querySelectorAll('[data-sp-availability]'), function (el) {
      var sku = el.getAttribute('data-sp-availability') || page.sku;
      if (sku) targets.push({ el: el, sku: sku });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-sp-availability-sku]'), function (el) {
      targets.push({ el: el, sku: el.getAttribute('data-sp-availability-sku') });
    });
    if (!targets.length) return;
    var skus = targets.map(function (t) { return t.sku; }).filter(function (s, i, a) { return a.indexOf(s) === i; }).slice(0, 100);
    fetch(ENDPOINT + '/api/public/availability?key=' + encodeURIComponent(KEY) + '&skus=' + skus.map(encodeURIComponent).join(','))
      .then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .then(function (res) {
        var bySku = {};
        (res.items || []).forEach(function (a) { bySku[a.sku] = a; });
        targets.forEach(function (t) { renderAvailability(t.el, bySku[t.sku]); });
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadAvailability);
  else loadAvailability();

  // --- Klick-Analyse & Frust-Signale ---------------------------------------
  // Datenschutz: keine Texteingaben/Formularwerte; Bereiche mit [data-sp-private] werden ignoriert;
  // Beschriftungen nur fuer klickbare Elemente/Bilder, gekuerzt und ohne E-Mail-Adressen/Nummern.

  var INTERACTIVE = 'a[href],button,input,select,textarea,label,summary,[role=button],[role=link],[role=tab],' +
    '[role=checkbox],[role=menuitem],[onclick],[data-sp-add-to-cart],[tabindex]:not([tabindex="-1"])';
  var STABLE_ATTRS = ['data-sp-variant-sku', 'data-sp-add-to-cart', 'data-testid', 'name', 'aria-label'];
  var MAX_CLICKS_PER_PAGE = 60;
  var clickCount = 0;
  var overlayActive = false;

  function deviceClass() {
    var w = window.innerWidth;
    return w < 768 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop';
  }

  function esc(v) {
    return window.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/[^\w-]/g, '\\$&');
  }

  /** Moeglichst stabiler CSS-Selektor (IDs, data-Attribute, sonst Tag/Klassen/Position, max. 5 Ebenen). */
  function selectorFor(el) {
    var parts = [];
    var node = el;
    for (var depth = 0; node && node.nodeType === 1 && depth < 5; depth++) {
      if (node === document.body || node === document.documentElement) break;
      if (node.id && !/\d{3,}/.test(node.id)) {
        parts.unshift('#' + esc(node.id));
        break;
      }
      var tag = node.tagName.toLowerCase();
      var stable = null;
      for (var i = 0; i < STABLE_ATTRS.length && !stable; i++) {
        var v = node.getAttribute(STABLE_ATTRS[i]);
        if (v !== null && v.length <= 60) stable = tag + '[' + STABLE_ATTRS[i] + (v ? '="' + v.replace(/"/g, '\\"') + '"' : '') + ']';
      }
      if (stable) {
        parts.unshift(stable);
        break;
      }
      var cls = (node.getAttribute('class') || '').split(/\s+/).filter(function (c) {
        return c && c.length < 30 && !/\d{3,}/.test(c) && c.indexOf('sp-') !== 0;
      }).slice(0, 2);
      var part = tag + cls.map(function (c) { return '.' + esc(c); }).join('');
      var parent = node.parentElement;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === node.tagName; });
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ').slice(0, 200) || el.tagName.toLowerCase();
  }

  function labelFor(el, interactive) {
    if (el.closest('input,textarea,select,[contenteditable],[data-sp-private]')) return null;
    var t = el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title') || '';
    if (!t && (interactive || el.children.length === 0)) t = el.innerText || el.textContent || '';
    t = String(t).replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!t || /@/.test(t) || /\d{5,}/.test(t)) return null;
    return t;
  }

  function watchClicks() {
    var recent = [];
    var rageLock = 0;
    var mutated = false;
    if (window.MutationObserver) {
      new MutationObserver(function () { mutated = true; }).observe(document.documentElement, {
        subtree: true, childList: true, attributes: true, characterData: true,
      });
    }
    document.addEventListener('click', function (ev) {
      var target = ev.target;
      if (!target || target.nodeType !== 1 || target.closest('[data-sp-private]')) return;
      var interactive = target.closest(INTERACTIVE);
      var el = interactive || target;
      var rect = el.getBoundingClientRect();
      var doc = document.documentElement;
      var info = {
        selector: selectorFor(el),
        label: labelFor(el, !!interactive),
        ox: rect.width ? (ev.clientX - rect.left) / rect.width : 0.5,
        oy: rect.height ? (ev.clientY - rect.top) / rect.height : 0.5,
        px: (ev.clientX + window.scrollX) / Math.max(doc.scrollWidth, 1),
        py: (ev.clientY + window.scrollY) / Math.max(doc.scrollHeight, 1),
        device: deviceClass(),
        path: location.pathname,
      };
      if (clickCount < MAX_CLICKS_PER_PAGE) {
        clickCount++;
        track('click', { click: info });
      }
      // Frust-Klicks: >= 3 Klicks innerhalb 1 s im Umkreis von 30 px
      var now = Date.now();
      recent = recent.filter(function (c) { return now - c.t < 1000; });
      recent.push({ t: now, x: ev.clientX, y: ev.clientY });
      var near = recent.filter(function (c) { return Math.abs(c.x - ev.clientX) < 30 && Math.abs(c.y - ev.clientY) < 30; });
      if (near.length >= 3 && now > rageLock) {
        track('rage_click', { click: info });
        rageLock = now + 1500;
        recent = [];
      }
      // Klick ins Leere: nicht klickbares Element, danach 1 s lang keine Reaktion der Seite
      if (!interactive && window.getComputedStyle(target).cursor !== 'pointer') {
        mutated = false;
        var href = location.href;
        setTimeout(function () {
          if (!mutated && location.href === href) track('dead_click', { click: info });
        }, 1000);
      }
    }, true);
  }

  // --- Heatmap-Ansicht direkt auf der Shopseite (nur ueber signierten Link aus dem Dashboard) --------

  function heatmapToken() {
    var m = location.search.match(/[?&]sp_heatmap=([^&#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function heatColor(a) {
    // 0 -> blau, 0.5 -> gelb, 1 -> rot
    var r = Math.round(255 * Math.min(1, a * 2));
    var g = Math.round(255 * (a < 0.5 ? a * 2 : 2 - a * 2));
    var b = Math.round(255 * Math.max(0, 1 - a * 3));
    return [r, g, b];
  }

  function renderHeatmap(data, onlyFrust) {
    Array.prototype.forEach.call(document.querySelectorAll('.sp-heatmap-ui'), function (n) { n.remove(); });
    var doc = document.documentElement;
    var W = Math.max(doc.scrollWidth, window.innerWidth);
    var H = Math.max(doc.scrollHeight, window.innerHeight);
    // Dichteraster (4 px je Zelle) mit Gauss-Kern; logarithmische Farbskala, damit sowohl
    // Schwerpunkte als auch seltene Klickstellen sichtbar bleiben
    var CELL = 4, RADIUS = 6; // 6 Zellen = 24 px
    var gw = Math.ceil(W / CELL), gh = Math.ceil(H / CELL);
    var grid = new Float32Array(gw * gh);
    var kernel = [];
    for (var ky = -RADIUS; ky <= RADIUS; ky++) {
      for (var kx = -RADIUS; kx <= RADIUS; kx++) {
        var dist2 = kx * kx + ky * ky;
        if (dist2 <= RADIUS * RADIUS) kernel.push([kx, ky, Math.exp(-dist2 / (2 * (RADIUS / 2) * (RADIUS / 2)))]);
      }
    }
    var cache = {};
    var find = function (sel) {
      if (!(sel in cache)) {
        try { cache[sel] = document.querySelector(sel); } catch (e) { cache[sel] = null; }
      }
      return cache[sel];
    };
    var pts = (data.points || []).filter(function (p) { return !onlyFrust || p.k !== 'click'; });
    pts.forEach(function (p) {
      var el = find(p.s);
      var r = el && el.getBoundingClientRect();
      var x, y;
      if (r && r.width && r.height && p.ox != null) {
        x = r.left + window.scrollX + p.ox * r.width;
        y = r.top + window.scrollY + p.oy * r.height;
      } else {
        x = (p.px || 0) * W;
        y = (p.py || 0) * H;
      }
      var cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      for (var i = 0; i < kernel.length; i++) {
        var gx = cx + kernel[i][0], gy = cy + kernel[i][1];
        if (gx >= 0 && gy >= 0 && gx < gw && gy < gh) grid[gy * gw + gx] += kernel[i][2];
      }
    });
    var max = 0;
    for (var m = 0; m < grid.length; m++) if (grid[m] > max) max = grid[m];
    var canvas = document.createElement('canvas');
    canvas.className = 'sp-heatmap-ui';
    canvas.width = gw;
    canvas.height = gh;
    canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:2147483645;opacity:0.7;image-rendering:auto;' +
      'width:' + gw * CELL + 'px;height:' + gh * CELL + 'px';
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(gw, gh);
    var logMax = Math.log(1 + (max || 1));
    for (var q = 0; q < grid.length; q++) {
      var v = grid[q];
      if (v < 0.05) continue;
      var a = Math.log(1 + v) / logMax;
      var c = heatColor(a);
      img.data[q * 4] = c[0];
      img.data[q * 4 + 1] = c[1];
      img.data[q * 4 + 2] = c[2];
      img.data[q * 4 + 3] = Math.round(70 + 185 * a);
    }
    ctx.putImageData(img, 0, 0);
    document.body.appendChild(canvas);

    // Problem-Elemente markieren
    (data.elements || []).forEach(function (e) {
      if (!e.rage && !e.dead) return;
      var el = find(e.selector);
      if (!el) return;
      var r = el.getBoundingClientRect();
      var box = document.createElement('div');
      box.className = 'sp-heatmap-ui';
      box.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483646;border-radius:4px;box-sizing:border-box;' +
        'left:' + (r.left + window.scrollX - 3) + 'px;top:' + (r.top + window.scrollY - 3) + 'px;width:' + (r.width + 6) + 'px;height:' + (r.height + 6) + 'px;' +
        (e.rage ? 'border:3px solid #d62d45;' : 'border:3px dashed #e08a00;');
      var tag = document.createElement('div');
      tag.textContent = (e.rage ? e.rage + '× Frust-Klick' : '') + (e.rage && e.dead ? ' · ' : '') + (e.dead ? e.dead + '× ins Leere' : '');
      tag.style.cssText = 'position:absolute;left:-3px;top:-24px;white-space:nowrap;font:600 12px system-ui,sans-serif;color:#fff;padding:2px 6px;border-radius:4px;background:' + (e.rage ? '#d62d45' : '#b36a00');
      box.appendChild(tag);
      document.body.appendChild(box);
    });

    var panel = document.createElement('div');
    panel.className = 'sp-heatmap-ui';
    panel.style.cssText = 'position:fixed;right:16px;top:16px;z-index:2147483647;background:#111827;color:#f3f4f6;padding:12px 14px;border-radius:10px;' +
      'font:13px/1.45 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:300px';
    var title = document.createElement('strong');
    title.textContent = 'ShopPulse Heatmap';
    panel.appendChild(title);
    var meta = document.createElement('div');
    meta.textContent = data.pageKey + ' · ' + (data.device || 'alle Geräte') + ' · ' + pts.length + ' Klicks · letzte ' + data.days + ' Tage';
    meta.style.cssText = 'color:#9ca3af;margin:2px 0 8px';
    panel.appendChild(meta);
    var legend = document.createElement('div');
    legend.innerHTML = '<span style="display:inline-block;width:80px;height:8px;border-radius:4px;background:linear-gradient(90deg,#3050ff,#ffe000,#ff2000);vertical-align:middle"></span> wenige → viele Klicks<br>' +
      '<span style="color:#ff6b7f">■</span> Frust-Klicks &nbsp; <span style="color:#ffb44d">■</span> Klicks ins Leere';
    panel.appendChild(legend);
    var btns = document.createElement('div');
    btns.style.cssText = 'margin-top:8px;display:flex;gap:6px';
    var mk = function (text, fn) {
      var b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = 'border:0;border-radius:6px;padding:4px 8px;cursor:pointer;font:600 12px system-ui;background:#374151;color:#fff';
      b.onclick = fn;
      btns.appendChild(b);
    };
    mk(onlyFrust ? 'Alle Klicks' : 'Nur Frust-Signale', function () { renderHeatmap(data, !onlyFrust); });
    mk('Schließen', function () { Array.prototype.forEach.call(document.querySelectorAll('.sp-heatmap-ui'), function (n) { n.remove(); }); });
    panel.appendChild(btns);
    document.body.appendChild(panel);
  }

  function startHeatmapMode(token) {
    overlayActive = true; // Betreiberansicht: kein Tracking
    var run = function () {
      fetch(ENDPOINT + '/api/public/heatmap?key=' + encodeURIComponent(KEY) + '&token=' + encodeURIComponent(token))
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (data) {
          renderHeatmap(data, false);
          var t;
          window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { renderHeatmap(data, false); }, 300); });
        })
        .catch(function () {
          var n = document.createElement('div');
          n.className = 'sp-heatmap-ui';
          n.textContent = 'ShopPulse: Heatmap-Link ungültig oder abgelaufen – bitte im Dashboard neu öffnen.';
          n.style.cssText = 'position:fixed;right:16px;top:16px;z-index:2147483647;background:#7f1d1d;color:#fff;padding:10px 14px;border-radius:8px;font:13px system-ui';
          document.body.appendChild(n);
        });
    };
    if (document.readyState === 'complete') setTimeout(run, 300);
    else window.addEventListener('load', function () { setTimeout(run, 300); });
  }

  var hmToken = heatmapToken();
  if (hmToken && KEY) startHeatmapMode(hmToken);

  // --- Start --------------------------------------------------------------

  function start() {
    if (started || !consent || !KEY || overlayActive) return;
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
    watchClicks();
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
    /** Verfuegbarkeit neu laden, z. B. nach Variantenwechsel oder AJAX-Nachladen */
    refreshAvailability: function () { loadAvailability(); },
  };

  document.addEventListener('shoppulse:consent', function (e) {
    window.ShopPulse.consent(!e.detail || e.detail.granted !== false);
  });
  if (consent) window.ShopPulse.consent(true);
})();

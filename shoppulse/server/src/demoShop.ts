import { Router } from 'express';
import { db, type ProductRow, type ShopRow } from './db/index.js';
import { demoErpCsv } from './db/demoData.js';
import { userFromRequest } from './auth/index.js';

/**
 * Minimaler Beispiel-Shop, um das Snippet (Tracking, Consent, Nudges) live auszuprobieren:
 * GET /demo-shop/:shopId[/checkout|/confirmation]
 */
export const demoShopRouter = Router();

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(shop: ShopRow, page: string, attrs: string, body: string) {
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(shop.name)} – Demo-Shop</title>
<style>
 body{font-family:system-ui,sans-serif;margin:0;background:#fafafa;color:#222}
 header{background:#222;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center}
 main{max-width:860px;margin:24px auto;padding:0 16px}
 .card{background:#fff;border:1px solid #e3e3e3;border-radius:10px;padding:20px;margin-bottom:16px}
 .price{font-size:28px;font-weight:700} button,.btn{background:#1f5eff;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:15px;cursor:pointer;text-decoration:none;display:inline-block}
 .variants{display:flex;gap:12px;flex-wrap:wrap}.variant{border:1px solid #ddd;border-radius:8px;padding:12px;min-width:150px}
 #consent{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #ccc;padding:14px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
 .spacer{height:900px;color:#999}
</style></head>
<body data-sp-page="${page}" ${attrs}>
<header><strong>${esc(shop.name)}</strong><span>Demo-Shop · ShopPulse-Snippet aktiv</span></header>
<main>${body}</main>
<div id="consent"><span>Wir nutzen ShopPulse, um den Shop anhand anonymisierter Nutzungsdaten zu verbessern.</span>
<button onclick="ShopPulse.consent(true);document.getElementById('consent').remove()">Einverstanden</button>
<button style="background:#888" onclick="ShopPulse.consent(false);document.getElementById('consent').remove()">Ablehnen</button></div>
<script>try{if(localStorage.getItem('shoppulse_vid'))document.addEventListener('DOMContentLoaded',function(){var c=document.getElementById('consent');if(c)c.remove();ShopPulse.consent(true)})}catch(e){}</script>
<script src="/snippet.js" data-key="${esc(shop.public_key)}"></script>
</body></html>`;
}

/** Simulierter ERP-Export fuer die Demo-Lagerintegration (CSV-Feed). */
demoShopRouter.get('/:shopId/erp-bestand.csv', (req, res) => {
  const shop = db.prepare('SELECT * FROM shops WHERE id = ? AND is_demo = 1').get(req.params.shopId);
  if (!shop) return res.status(404).send('Nur für Demo-Shops verfügbar');
  res.type('text/csv').send(demoErpCsv());
});

demoShopRouter.get('/:shopId/:step?', (req, res) => {
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.shopId) as ShopRow | undefined;
  // Echte Shops nur fuer angemeldete Mitglieder der eigenen Organisation – Produkte, Preise und
  // Bestaende sind Geschaeftsdaten. Demo-Shops (synthetische Daten) sind frei zugaenglich.
  const user = shop && !shop.is_demo ? userFromRequest(req) : undefined;
  if (!shop || (!shop.is_demo && user?.orgId !== shop.org_id)) return res.status(404).send('Shop nicht gefunden');
  res.set('X-Robots-Tag', 'noindex');
  const products = db.prepare('SELECT * FROM products WHERE shop_id = ? ORDER BY id').all(shop.id) as ProductRow[];
  const requested = typeof req.query.sku === 'string' ? products.find((x) => x.sku === req.query.sku) : undefined;
  const p = requested ?? products[0] ?? { sku: 'DEMO-1', name: 'Demo-Produkt', price: 49.9, stock: 4 };
  const base = `/demo-shop/${shop.id}`;
  res.type('html');

  if (req.params.step === 'checkout') {
    return res.send(
      layout(shop, 'checkout', '', `<div class="card"><h2>Kasse</h2><p>${esc(p.name)} – ${p.price.toFixed(2)} €</p>
      <a class="btn" href="${base}/confirmation">Zahlungspflichtig bestellen</a></div>`),
    );
  }
  if (req.params.step === 'confirmation') {
    return res.send(
      layout(
        shop,
        'confirmation',
        `data-sp-order-value="${p.price}" data-sp-order-skus="${esc(p.sku)}"`,
        `<div class="card"><h2>Danke für Ihre Bestellung!</h2><p>Bestellwert ${p.price.toFixed(2)} €. Der Kauf wurde an ShopPulse gemeldet.</p>
        <a href="${base}">Zurück zum Produkt</a></div>`,
      ),
    );
  }

  const reference = Math.round(p.price * 1.2 * 100) / 100;
  const variants = products.length >= 2 ? products : [];
  res.send(
    layout(
      shop,
      'product',
      `data-sp-sku="${esc(p.sku)}" data-sp-price="${p.price}" data-sp-reference-price="${reference}" data-sp-stock="${p.stock ?? ''}"`,
      `<div class="card">
        <label>Sortieren: <select data-sp-price-filter><option>Relevanz</option><option>Preis aufsteigend</option></select></label>
        <h1>${esc(p.name)}</h1>
        <div class="price">${p.price.toFixed(2).replace('.', ',')} €</div>
        <p style="color:#777;font-size:13px">Niedrigster Preis der letzten 30 Tage: ${reference.toFixed(2).replace('.', ',')} € (Demo-Referenzpreis)</p>
        <div data-sp-availability style="margin:10px 0"></div>
        <div data-sp-nudge-slot></div>
        <button data-sp-add-to-cart onclick="location.href='${base}/checkout'">In den Warenkorb</button>
        <p style="font-size:13px;color:#666">Tipp: Mauszeiger &gt; 2 s über dem Button halten, ohne zu klicken → "Zögern" wird gemessen.</p>
      </div>
      ${
        variants.length
          ? `<div class="card"><h3>Weitere Produkte</h3><div class="variants">${variants
              .map(
                (v) =>
                  `<a class="variant" style="color:inherit;text-decoration:none" href="${base}?sku=${encodeURIComponent(v.sku)}" data-sp-variant-sku="${esc(v.sku)}"><strong>${esc(v.name)}</strong><br>${v.price.toFixed(2)} €<div data-sp-availability-sku="${esc(v.sku)}" data-sp-show-stores="false" style="margin-top:6px"></div></a>`,
              )
              .join('')}</div></div>`
          : ''
      }
      <div class="spacer">Produktbeschreibung … (Scrolltiefe wird gemessen)</div>`,
    ),
  );
});

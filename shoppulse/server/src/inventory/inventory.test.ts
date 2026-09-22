import { test } from 'node:test';
import assert from 'node:assert/strict';

// In-Memory-Datenbank fuer diese Tests (muss vor dem ersten DB-Import gesetzt sein)
process.env.SHOPPULSE_DB = ':memory:';
const { db } = await import('../db/index.js');
const { parseInventoryCsv } = await import('./csv.js');
const { ingestInventory } = await import('./ingest.js');
const { getAvailability } = await import('./availability.js');
const { shopifyConnector } = await import('./connectors/shopify.js');
const { shopwareConnector } = await import('./connectors/shopware.js');
const { woocommerceConnector } = await import('./connectors/woocommerce.js');
const { csvFeedConnector } = await import('./connectors/csvFeed.js');
type SourceRow = import('./ingest.js').SourceRow;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// --- CSV ---------------------------------------------------------------------

test('CSV: deutsche Spaltennamen, Semikolon, Tausenderpunkt, Fehlerzeilen', () => {
  const r = parseInventoryCsv('﻿Artikelnummer;Bestand;Lager;EAN\nA-1;1.200;Zentrallager;400\nA-2;abc;Zentrallager;\n;5;X;\nA-3;7;;');
  assert.deepEqual(r.levels, [
    { sku: 'A-1', quantity: 1200, location: 'Zentrallager', ean: '400' },
    { sku: 'A-3', quantity: 7, location: null, ean: null },
  ]);
  assert.equal(r.errors.length, 2);
});

test('CSV: fehlende Pflichtspalten werden gemeldet', () => {
  const r = parseInventoryCsv('name,preis\nx,1');
  assert.equal(r.levels.length, 0);
  assert.match(r.errors[0], /SKU und Bestand/);
});

// --- Connectoren (gegen simulierte APIs) --------------------------------------

test('Shopify: Paginierung, mehrere Standorte, nicht getrackte Varianten ignoriert', async () => {
  const pages = [
    {
      data: {
        productVariants: {
          pageInfo: { hasNextPage: true, endCursor: 'c1' },
          nodes: [
            {
              sku: 'A-1',
              barcode: '4001',
              inventoryItem: {
                tracked: true,
                inventoryLevels: {
                  nodes: [
                    { location: { id: 'gid://shopify/Location/1', name: 'Lager' }, quantities: [{ name: 'available', quantity: 5 }] },
                    { location: { id: 'gid://shopify/Location/2', name: 'Laden' }, quantities: [{ name: 'available', quantity: 2 }] },
                  ],
                },
              },
            },
            { sku: 'NOTRACK', barcode: null, inventoryItem: { tracked: false, inventoryLevels: { nodes: [] } } },
          ],
        },
      },
    },
    {
      data: {
        productVariants: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            {
              sku: 'A-2',
              barcode: '',
              inventoryItem: {
                tracked: true,
                inventoryLevels: { nodes: [{ location: { id: 'gid://shopify/Location/1', name: 'Lager' }, quantities: [{ name: 'available', quantity: 0 }] }] },
              },
            },
          ],
        },
      },
    },
  ];
  const calls: { url: string; init?: RequestInit }[] = [];
  const snap = await shopifyConnector.fetchSnapshot({ shopDomain: 'https://test.myshopify.com/', accessToken: 'shpat_x' }, async (url, init) => {
    calls.push({ url, init });
    return json(pages[calls.length - 1]);
  });
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /^https:\/\/test\.myshopify\.com\/admin\/api\/.+\/graphql\.json$/);
  assert.equal((calls[0].init!.headers as Record<string, string>)['X-Shopify-Access-Token'], 'shpat_x');
  assert.equal(JSON.parse(String(calls[1].init!.body)).variables.cursor, 'c1');
  assert.equal(snap.locations.length, 2);
  assert.deepEqual(
    snap.levels.map((l) => [l.sku, l.location, l.quantity]),
    [
      ['A-1', 'gid://shopify/Location/1', 5],
      ['A-1', 'gid://shopify/Location/2', 2],
      ['A-2', 'gid://shopify/Location/1', 0],
    ],
  );
});

test('Shopify: API-Fehler wird als verständliche Meldung weitergegeben', async () => {
  await assert.rejects(
    shopifyConnector.fetchSnapshot({ shopDomain: 'x.myshopify.com', accessToken: 'bad' }, async () => json({}, 401)),
    /HTTP 401/,
  );
});

test('Shopware: Token holen, availableStock je Produktnummer', async () => {
  const snap = await shopwareConnector.fetchSnapshot({ baseUrl: 'https://sw.test/', clientId: 'id', clientSecret: 's' }, async (url, init) => {
    if (url.endsWith('/api/oauth/token')) return json({ access_token: 'tok' });
    assert.equal((init!.headers as Record<string, string>).Authorization, 'Bearer tok');
    return json({ data: [{ productNumber: 'SW-1', ean: '123', availableStock: 3, stock: 5 }, { productNumber: null }] });
  });
  assert.deepEqual(snap.levels, [{ sku: 'SW-1', ean: '123', quantity: 3 }]);
});

test('WooCommerce: variable Produkte über Variationen, nur Artikel mit Bestandsführung', async () => {
  const snap = await woocommerceConnector.fetchSnapshot(
    { baseUrl: 'https://woo.test', consumerKey: 'ck', consumerSecret: 'cs' },
    async (url, init) => {
      assert.match(String((init!.headers as Record<string, string>).Authorization), /^Basic /);
      if (url.includes('/products/7/variations')) {
        return json([
          { sku: 'W-7-S', manage_stock: true, stock_quantity: 2 },
          { sku: 'W-7-M', manage_stock: true, stock_quantity: 0 },
        ]);
      }
      return json([
        { id: 1, type: 'simple', sku: 'W-1', manage_stock: true, stock_quantity: 9 },
        { id: 2, type: 'simple', sku: 'W-2', manage_stock: false, stock_quantity: null },
        { id: 7, type: 'variable', sku: 'W-7' },
      ]);
    },
  );
  assert.deepEqual(snap.levels.map((l) => [l.sku, l.quantity]), [['W-1', 9], ['W-7-S', 2], ['W-7-M', 0]]);
});

test('CSV-Feed: Lagerorte aus der Spalte "Lager"', async () => {
  const snap = await csvFeedConnector.fetchSnapshot({ url: 'https://erp.test/b.csv' }, async () =>
    new Response('sku,qty,warehouse\nA,1,Nord\nB,2,Süd\nC,3,Nord'),
  );
  assert.deepEqual(snap.locations.map((l) => l.externalId).sort(), ['Nord', 'Süd']);
  assert.equal(snap.levels.length, 3);
});

// --- Ingest & Verfuegbarkeit --------------------------------------------------

function setupShop() {
  const shopId = Number(
    db.prepare(`INSERT INTO shops (name, domain, public_key) VALUES ('T', 't.de', ?)`).run('pk_' + Math.random()).lastInsertRowid,
  );
  db.prepare(`INSERT INTO products (shop_id, sku, ean, name, price, stock) VALUES (?, 'P1', '999', 'Produkt 1', 10, 50)`).run(shopId);
  db.prepare(`INSERT INTO products (shop_id, sku, name, price, stock) VALUES (?, 'P2', 'Produkt 2', 10, 7)`).run(shopId);
  const mk = (name: string, type: string) =>
    db
      .prepare('SELECT * FROM inventory_sources WHERE id = ?')
      .get(db.prepare(`INSERT INTO inventory_sources (shop_id, name, type) VALUES (?, ?, ?)`).run(shopId, name, type).lastInsertRowid) as SourceRow;
  return { shopId, erp: mk('ERP', 'csv_url'), pos: mk('Kasse', 'push') };
}

const stock = (shopId: number, sku: string) =>
  (db.prepare('SELECT stock FROM products WHERE shop_id = ? AND sku = ?').get(shopId, sku) as { stock: number }).stock;

test('Mehrere Tools: Bestände je Quelle getrennt, Onlinebestand = Summe der Online-Lager', () => {
  const { shopId, erp, pos } = setupShop();
  ingestInventory(erp, { levels: [{ sku: 'P1', quantity: 3, location: 'ZL' }, { sku: 'P1', quantity: 2, location: 'ZL' }] }, 'snapshot');
  ingestInventory(pos, { locations: [{ externalId: 'F1', name: 'Filiale 1', kind: 'store' }], levels: [{ sku: 'P1', quantity: 8, location: 'F1' }] }, 'snapshot');
  // Zeilen gleicher SKU am gleichen Ort werden summiert; Filialen zaehlen nicht zum Onlinebestand
  assert.equal(stock(shopId, 'P1'), 5);
  // P2 hat keinen integrierten Bestand -> manueller Wert bleibt
  assert.equal(stock(shopId, 'P2'), 7);

  // Kasse meldet per Upsert nur eine Aenderung – ERP-Daten bleiben unberuehrt
  ingestInventory(pos, { levels: [{ sku: 'P1', quantity: 1, location: 'F1' }] }, 'upsert');
  assert.equal(stock(shopId, 'P1'), 5);

  const [a] = getAvailability(shopId, ['P1']);
  assert.equal(a.status, 'low_stock');
  assert.equal(a.label, 'Nur noch 5 Stück auf Lager');
  assert.deepEqual(a.stores, [{ name: 'Filiale 1', status: 'low', label: 'nur noch wenige' }]);
});

test('Zuordnung per EAN, wenn das Fremdsystem eine andere Artikelnummer nutzt', () => {
  const { shopId, erp } = setupShop();
  ingestInventory(erp, { levels: [{ sku: 'ERP-4711', ean: '999', quantity: 40 }] }, 'snapshot');
  assert.equal(stock(shopId, 'P1'), 40);
  assert.equal(getAvailability(shopId, ['P1'])[0].status, 'in_stock');
});

test('Snapshot entfernt Altbestände; Sicherheitsstopp bei leerem oder eingebrochenem Snapshot', () => {
  const { erp } = setupShop();
  const many = Array.from({ length: 30 }, (_, i) => ({ sku: `S${i}`, quantity: 5 }));
  ingestInventory(erp, { levels: many }, 'snapshot');
  const r1 = ingestInventory(erp, { levels: many.slice(0, 25) }, 'snapshot');
  assert.equal(r1.status, 'ok');
  assert.equal(r1.removed, 5);

  const r2 = ingestInventory(erp, { levels: [] }, 'snapshot');
  assert.equal(r2.status, 'blocked');
  const r3 = ingestInventory(erp, { levels: many.slice(0, 2) }, 'snapshot');
  assert.equal(r3.status, 'blocked');
  const count = (db.prepare(
    'SELECT COUNT(*) as n FROM inventory_levels l JOIN inventory_locations loc ON loc.id = l.location_id WHERE loc.source_id = ?',
  ).get(erp.id) as { n: number }).n;
  assert.equal(count, 25);

  const r4 = ingestInventory(erp, { levels: many.slice(0, 2) }, 'snapshot', { force: true });
  assert.equal(r4.status, 'ok');
});

test('Verfügbarkeit: ausverkauft online, aber in Filiale – und veraltete Daten werden nicht gezeigt', () => {
  const { shopId, erp, pos } = setupShop();
  ingestInventory(erp, { levels: [{ sku: 'P2', quantity: 0 }] }, 'snapshot');
  ingestInventory(pos, { locations: [{ externalId: 'F', name: 'Filiale Mitte', kind: 'store' }], levels: [{ sku: 'P2', quantity: 9, location: 'F' }] }, 'snapshot');
  const [a] = getAvailability(shopId, ['P2']);
  assert.equal(a.status, 'out_of_stock');
  assert.match(a.label!, /vorrätig in: Filiale Mitte/);

  db.prepare(`UPDATE inventory_levels SET updated_at = datetime('now', '-3 days') WHERE shop_id = ?`).run(shopId);
  const [stale] = getAvailability(shopId, ['P2']);
  assert.equal(stale.status, 'unknown');
  assert.equal(stale.label, null);
  assert.deepEqual(stale.stores, []);
});

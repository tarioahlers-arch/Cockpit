import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

process.env.SHOPPULSE_DB = ':memory:';
process.env.SHOPPULSE_LOGIN_MAX_ATTEMPTS = '1000';
const { createApp } = await import('../app.js');
const { isPrivateAddress, guardedFetch, OutboundBlockedError } = await import('./outbound.js');

let server: Server;
let base = '';

/** Minimaler HTTP-Client mit Cookie-Speicher (eine Instanz = ein Browser). */
class Client {
  cookie = '';
  constructor(private csrf = true) {}
  async call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(this.csrf ? { 'X-Requested-With': 'ShopPulse' } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* HTML/Text */
    }
    return { status: res.status, json, text, headers: res.headers };
  }
}

const A = new Client();
const B = new Client();
const anon = new Client();

// IDs der Ressourcen von Organisation A
const a: Record<string, any> = {};
const b: Record<string, any> = {};

async function setupOrg(c: Client, tag: string, store: Record<string, any>) {
  let r = await c.call('POST', '/api/auth/register', { email: `${tag}@firma.de`, password: 'sehr-geheim-123', organization: `Firma ${tag}` });
  assert.equal(r.status, 201);
  assert.match(r.headers.get('set-cookie')!, /HttpOnly/);
  assert.match(r.headers.get('set-cookie')!, /SameSite=Strict/);

  r = await c.call('POST', '/api/shops', { name: `Shop ${tag}`, domain: `${tag}-shop.de` });
  store.shop = r.json;
  r = await c.call('POST', `/api/shops/${store.shop.id}/products`, { sku: 'SKU-1', name: `Jacke ${tag}`, price: 100, unitCost: 40 });
  store.product = r.json;
  await c.call('POST', `/api/products/${store.product.id}/history`, { price: 100, unitsSold: 10 });
  await c.call('POST', `/api/shops/${store.shop.id}/competitor-offers`, { offers: [{ competitor: 'X', title: 'Unpassend Zelt', price: 5 }] });
  r = await c.call('GET', `/api/shops/${store.shop.id}/pricing`);
  store.offer = r.json.unmatchedOffers[0];
  r = await c.call('POST', `/api/shops/${store.shop.id}/experiments`, { nudgeType: 'social_proof' });
  store.experiment = r.json;
  r = await c.call('POST', `/api/shops/${store.shop.id}/inventory/sources`, { type: 'push', name: `Kasse ${tag}` });
  store.source = r.json;
  store.pushToken = r.json.pushToken;
  assert.match(store.pushToken, /^inv_/);
}

before(async () => {
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await setupOrg(A, 'a', a);
  await setupOrg(B, 'b', b);

  // Beide Shops fuehren dieselbe SKU – mit unterschiedlichen Bestaenden
  for (const [org, qty] of [[a, 3], [b, 999]] as const) {
    const r = await fetch(`${base}/api/inventory/push`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${org.pushToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ levels: [{ sku: 'SKU-1', quantity: qty, location: 'L1' }] }),
    });
    assert.equal(r.status, 200);
  }
  const inv = await A.call('GET', `/api/shops/${a.shop.id}/inventory`);
  a.location = inv.json.locations[0];
});

after(() => server.close());

describe('Mandantentrennung', () => {
  test('Shop-Liste enthält nur Shops der eigenen Organisation', async () => {
    const ra = await A.call('GET', '/api/shops');
    const rb = await B.call('GET', '/api/shops');
    assert.deepEqual(ra.json.map((s: any) => s.id), [a.shop.id]);
    assert.deepEqual(rb.json.map((s: any) => s.id), [b.shop.id]);
  });

  // Jeder Endpunkt, der eine fremde ID annimmt – B greift auf A zu
  const attacks = () => [
    ['GET', `/api/shops/${a.shop.id}`],
    ['GET', `/api/shops/${a.shop.id}/overview`],
    ['GET', `/api/shops/${a.shop.id}/experiments`],
    ['POST', `/api/shops/${a.shop.id}/experiments`, { nudgeType: 'scarcity' }],
    ['PATCH', `/api/experiments/${a.experiment.id}`, { status: 'running' }],
    ['DELETE', `/api/experiments/${a.experiment.id}`],
    ['GET', `/api/shops/${a.shop.id}/pricing`],
    ['POST', `/api/shops/${a.shop.id}/products`, { sku: 'SKU-1', name: 'gehackt', price: 1 }],
    ['POST', `/api/products/${a.product.id}/history`, { price: 1, unitsSold: 1000 }],
    ['POST', `/api/shops/${a.shop.id}/competitor-offers`, { offers: [{ competitor: 'X', title: 'x', price: 1 }] }],
    ['PATCH', `/api/competitor-offers/${a.offer.id}`, { productId: a.product.id }],
    ['GET', `/api/shops/${a.shop.id}/inventory`],
    ['POST', `/api/shops/${a.shop.id}/inventory/sources`, { type: 'push' }],
    ['PATCH', `/api/inventory/sources/${a.source.id}`, { active: false }],
    ['POST', `/api/inventory/sources/${a.source.id}/sync`, {}],
    ['POST', `/api/inventory/sources/${a.source.id}/upload`, { csv: 'sku;bestand\nSKU-1;0', mode: 'snapshot', force: true }],
    ['POST', `/api/inventory/sources/${a.source.id}/token`, {}],
    ['DELETE', `/api/inventory/sources/${a.source.id}`],
    ['PATCH', `/api/inventory/locations/${a.location.id}`, { countsForOnline: false }],
    ['PUT', `/api/shops/${a.shop.id}/inventory/settings`, { maxAgeHours: 1 }],
    ['DELETE', `/api/shops/${a.shop.id}`],
  ] as [string, string, unknown?][];

  test('Organisation B erhält auf alle Ressourcen von A nur 404', async () => {
    for (const [method, path, body] of attacks()) {
      const r = await B.call(method, path, body);
      assert.equal(r.status, 404, `${method} ${path} -> ${r.status} ${r.text.slice(0, 120)}`);
      // Die Antwort darf keine Daten von A enthalten
      assert.doesNotMatch(r.text, /Shop a|Jacke a|Kasse a/, `${method} ${path} leakt Daten`);
    }
  });

  test('B kann eigenes Angebot nicht einem Produkt von A zuordnen', async () => {
    const r = await B.call('PATCH', `/api/competitor-offers/${b.offer.id}`, { productId: a.product.id });
    assert.equal(r.status, 400);
  });

  test('Nach allen Angriffen sind die Daten von A unverändert', async () => {
    const shop = await A.call('GET', `/api/shops/${a.shop.id}`);
    assert.equal(shop.status, 200);
    const exps = await A.call('GET', `/api/shops/${a.shop.id}/experiments`);
    assert.equal(exps.json.length, 1);
    assert.equal(exps.json[0].status, 'draft');
    const pricing = await A.call('GET', `/api/shops/${a.shop.id}/pricing`);
    assert.equal(pricing.json.products.length, 1);
    assert.equal(pricing.json.products[0].product.name, 'Jacke a');
    assert.equal(pricing.json.products[0].history.length, 1);
    assert.equal(pricing.json.unmatchedOffers.length, 1);
    const inv = await A.call('GET', `/api/shops/${a.shop.id}/inventory`);
    assert.equal(inv.json.sources.length, 1);
    assert.equal(inv.json.sources[0].active, 1);
    assert.equal(inv.json.locations[0].counts_for_online, 1);
    assert.equal(inv.json.settings.max_age_hours, 24);
    assert.equal(inv.json.items[0].perLocation[a.location.id], 3);
  });

  test('Ohne Anmeldung: 401 auf allen Dashboard-Endpunkten', async () => {
    for (const [method, path, body] of [['GET', '/api/shops'], ...attacks()] as [string, string, unknown?][]) {
      const r = await anon.call(method, path, body);
      assert.equal(r.status, 401, `${method} ${path}`);
    }
  });

  test('Schreibende Anfragen ohne CSRF-Header werden abgelehnt', async () => {
    const noCsrf = new Client(false);
    noCsrf.cookie = A.cookie;
    const r = await noCsrf.call('DELETE', `/api/shops/${a.shop.id}`);
    assert.equal(r.status, 403);
    assert.equal((await A.call('GET', `/api/shops/${a.shop.id}`)).status, 200);
  });
});

describe('Öffentliche Endpunkte bleiben auf einen Shop begrenzt', () => {
  test('Verfügbarkeit mit dem Key von A zeigt nur den Bestand von A (gleiche SKU wie B)', async () => {
    const r = await anon.call('GET', `/api/public/availability?key=${a.shop.public_key}&skus=SKU-1`);
    assert.equal(r.json.items[0].status, 'low_stock');
    assert.equal(r.json.items[0].quantity, 3);
  });

  test('Push-Token von B schreibt nur in Shop B; ungültige Tokens werden abgewiesen', async () => {
    const r = await fetch(`${base}/api/inventory/push`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${b.pushToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ levels: [{ sku: 'SKU-1', quantity: 0, location: 'L1' }] }),
    });
    assert.equal(r.status, 200);
    const inv = await A.call('GET', `/api/shops/${a.shop.id}/inventory`);
    assert.equal(inv.json.items[0].perLocation[a.location.id], 3);

    const bad = await fetch(`${base}/api/inventory/push`, {
      method: 'POST',
      headers: { Authorization: 'Bearer inv_geraten', 'Content-Type': 'application/json' },
      body: JSON.stringify({ levels: [{ sku: 'SKU-1', quantity: 0 }] }),
    });
    assert.equal(bad.status, 401);
  });

  test('Test-Shop-Seite eines echten Shops: nur für die eigene Organisation', async () => {
    assert.equal((await anon.call('GET', `/demo-shop/${a.shop.id}`)).status, 404);
    assert.equal((await B.call('GET', `/demo-shop/${a.shop.id}`)).status, 404);
    const own = await A.call('GET', `/demo-shop/${a.shop.id}`);
    assert.equal(own.status, 200);
    assert.match(own.text, /Jacke a/);
  });
});

describe('Push-Token', () => {
  test('wird nur einmal ausgeliefert und nie in Listen angezeigt', async () => {
    const inv = await A.call('GET', `/api/shops/${a.shop.id}/inventory`);
    assert.ok(!inv.text.includes(a.pushToken));
    assert.equal(inv.json.sources[0].push_token_hint, a.pushToken.slice(-4));
    assert.equal(inv.json.sources[0].push_token_hash, undefined);
  });

  test('Neu erzeugen macht den alten Token sofort ungültig', async () => {
    const r = await A.call('POST', `/api/inventory/sources/${a.source.id}/token`, {});
    const push = (token: string) =>
      fetch(`${base}/api/inventory/push`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ levels: [{ sku: 'SKU-1', quantity: 3, location: 'L1' }] }),
      });
    assert.equal((await push(a.pushToken)).status, 401);
    assert.equal((await push(r.json.pushToken)).status, 200);
    a.pushToken = r.json.pushToken;
  });
});

describe('CORS', () => {
  test('Dashboard-API gibt fremden Origins keine Freigabe', async () => {
    const r = await A.call('GET', '/api/shops', undefined, { Origin: 'https://evil.example' });
    assert.equal(r.headers.get('access-control-allow-origin'), null);
    const pre = await fetch(`${base}/api/shops`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'DELETE' },
    });
    assert.equal(pre.headers.get('access-control-allow-origin'), null);
  });

  test('Öffentliche Shop-Endpunkte sind für alle Origins freigegeben (ohne Cookies)', async () => {
    const pre = await fetch(`${base}/api/collect`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://irgendein-shop.de', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    });
    assert.equal(pre.headers.get('access-control-allow-origin'), '*');
    assert.equal(pre.headers.get('access-control-allow-credentials'), null);
  });
});

describe('SSRF-Schutz', () => {
  test('interne Adressen werden als Quelle abgelehnt', async () => {
    for (const url of [
      'http://example.com/bestand.csv',
      'https://127.0.0.1/bestand.csv',
      'https://localhost/bestand.csv',
      'https://169.254.169.254/latest/meta-data',
      'https://10.1.2.3/x.csv',
      'https://[::1]/x.csv',
      'https://user:pw@example.com/x.csv',
    ]) {
      const r = await A.call('POST', `/api/shops/${a.shop.id}/inventory/sources`, { type: 'csv_url', config: { url } });
      assert.equal(r.status, 400, url);
    }
    const shopify = await A.call('POST', `/api/shops/${a.shop.id}/inventory/sources`, {
      type: 'shopify',
      config: { shopDomain: 'evil.example.com', accessToken: 'shpat_x' },
    });
    assert.equal(shopify.status, 400);
  });

  test('Adressklassifizierung', () => {
    for (const ip of ['10.0.0.1', '172.16.5.4', '192.168.1.1', '127.0.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      assert.ok(isPrivateAddress(ip), ip);
    }
    for (const ip of ['8.8.8.8', '172.32.0.1', '2a00:1450:4001::1']) assert.ok(!isPrivateAddress(ip), ip);
  });

  test('Weiterleitung auf ein internes Ziel wird blockiert', async () => {
    const fake = async () => new Response(null, { status: 302, headers: { location: 'https://10.0.0.1/geheim' } });
    await assert.rejects(guardedFetch({}, fake)('https://93.184.215.14/feed.csv'), OutboundBlockedError);
  });
});

describe('Anmeldung', () => {
  test('schwache Passwörter und doppelte Konten werden abgelehnt', async () => {
    const c = new Client();
    assert.equal((await c.call('POST', '/api/auth/register', { email: 'x@y.de', password: '123', organization: 'X' })).status, 400);
    assert.equal((await c.call('POST', '/api/auth/register', { email: 'A@firma.de', password: 'sehr-geheim-123', organization: 'X' })).status, 409);
  });

  test('falsches Passwort -> 401, Logout beendet die Session', async () => {
    const c = new Client();
    assert.equal((await c.call('POST', '/api/auth/login', { email: 'a@firma.de', password: 'falsch-falsch' })).status, 401);
    assert.equal((await c.call('POST', '/api/auth/login', { email: 'a@firma.de', password: 'sehr-geheim-123' })).status, 200);
    assert.equal((await c.call('GET', '/api/shops')).status, 200);
    const old = c.cookie;
    await c.call('POST', '/api/auth/logout', {});
    const replay = new Client();
    replay.cookie = old;
    assert.equal((await replay.call('GET', '/api/shops')).status, 401);
  });
});

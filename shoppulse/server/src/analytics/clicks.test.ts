import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

process.env.SHOPPULSE_DB = ':memory:';
process.env.SHOPPULSE_MAIL_MODE = 'memory';
process.env.SHOPPULSE_LOGIN_MAX_ATTEMPTS = '1000';
const { createApp } = await import('../app.js');
const { db, invalidateEvents } = await import('../db/index.js');
const { normalizePath } = await import('../routes/public.js');
const { classifyVisitor, visitorFeatures } = await import('./segmentation.js');
const { signToken } = await import('../security/secrets.js');

let server: Server;
let base = '';
class Client {
  cookie = '';
  async call(method: string, p: string, body?: unknown) {
    const res = await fetch(base + p, {
      method,
      headers: { 'X-Requested-With': 'ShopPulse', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* leer */
    }
    return { status: res.status, json, text };
  }
}
const A = new Client();
const B = new Client();
let shopA: any;
let shopB: any;

const collect = (key: string, visitor: string, events: unknown[]) =>
  fetch(`${base}/api/collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, visitorId: visitor, sessionId: visitor + 's', events }),
  }).then((r) => r.json());

const clickEv = (type: string, selector: string, extra: Record<string, unknown> = {}) => ({
  type,
  pageType: 'checkout',
  selector,
  label: 'Gutschein einlösen',
  ox: 0.5,
  oy: 0.5,
  px: 0.4,
  py: 0.45,
  device: 'mobile',
  path: '/checkout/12345',
  ...extra,
});

before(async () => {
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await A.call('POST', '/api/auth/register', { email: 'a@ck.de', password: 'sehr-geheim-123', organization: 'A' });
  await B.call('POST', '/api/auth/register', { email: 'b@ck.de', password: 'sehr-geheim-123', organization: 'B' });
  shopA = (await A.call('POST', '/api/shops', { name: 'Shop A', domain: 'a.de' })).json;
  shopB = (await B.call('POST', '/api/shops', { name: 'Shop B', domain: 'b.de' })).json;
});
after(() => server.close());

describe('Erfassung', () => {
  test('Pfade werden normalisiert (keine Kunden- oder Bestellnummern im Seitenschlüssel)', () => {
    assert.deepEqual(normalizePath('/konto/bestellung/1234567?x=1'), { key: '/konto/bestellung/:id', path: '/konto/bestellung/1234567' });
    assert.equal(normalizePath('/produkt/9f8e7d6c5b4a39281706f5e4')!.key, '/produkt/:id');
    assert.equal(normalizePath('https://evil.de/x'), null);
  });

  test('Klicks landen in click_events, Frust-Signale zusätzlich als Ereignis; ungültige werden verworfen', async () => {
    const r = await collect(shopA.public_key, 'visitorAAAA1', [
      clickEv('click', '#voucher-apply'),
      clickEv('rage_click', '#voucher-apply'),
      clickEv('dead_click', '#product-image', { pageType: 'product', path: '/produkt/77777' }),
      { type: 'scroll_thrash', pageType: 'product' },
      clickEv('click', '#x', { device: 'smartwatch' }),
      clickEv('click', '', {}),
      clickEv('click', '#y', { path: 'https://evil.de/' }),
      clickEv('click', '#z', { label: 'x'.repeat(500), ox: 7, py: -3 }),
    ]);
    assert.equal(r.accepted, 5);
    const clicks = db.prepare('SELECT * FROM click_events WHERE shop_id = ? ORDER BY id').all(shopA.id) as any[];
    assert.equal(clicks.length, 4);
    assert.equal(clicks[0].page_key, '/checkout/:id');
    const long = clicks.find((c) => c.selector === '#z');
    assert.equal(long.label.length, 60);
    assert.equal(long.ox, 1);
    assert.equal(long.py, 0);
    const ev = db.prepare(`SELECT type FROM events WHERE shop_id = ? ORDER BY id`).all(shopA.id).map((x: any) => x.type);
    assert.deepEqual(ev, ['rage_click', 'dead_click', 'scroll_thrash']);
  });
});

describe('Segment "Frustriert"', () => {
  test('Frust-Klicks machen eine Besucherin zum Segment "frustriert"', () => {
    const rows = db.prepare(`SELECT * FROM events WHERE shop_id = ? AND visitor_id = 'visitorAAAA1'`).all(shopA.id) as any[];
    const f = visitorFeatures(rows).get('visitorAAAA1')!;
    assert.equal(f.rageClicks, 1);
    assert.equal(classifyVisitor(f).segment, 'frustrated');
  });
});

describe('Auswertung und Empfehlungen', () => {
  test('Frust-Kennzahlen, Problem-Elemente und elementgenaue Empfehlung', async () => {
    // 60 Checkout-Sessions: 30 mit Frust-Klick (kaufen selten), 30 ohne (kaufen oft)
    for (let i = 0; i < 60; i++) {
      const v = `visitorC${String(i).padStart(4, '0')}`;
      const frust = i < 30;
      const events: unknown[] = [{ type: 'page_view', pageType: 'checkout' }, clickEv('click', frust ? '#voucher-apply' : '#pay')];
      if (frust) events.push(clickEv('rage_click', '#voucher-apply'));
      if (frust ? i % 10 === 0 : i % 2 === 0) events.push({ type: 'purchase', pageType: 'confirmation', value: 100 });
      await collect(shopA.public_key, v, events);
    }
    invalidateEvents(shopA.id);
    const r = await A.call('GET', `/api/shops/${shopA.id}/clicks`);
    assert.equal(r.status, 200);
    assert.ok(r.json.summary.frustratedSessions >= 30);
    assert.ok(r.json.summary.conversionFrustrated < r.json.summary.conversionOthers);
    assert.equal(r.json.problemElements[0].selector, '#voucher-apply');
    const page = await A.call('GET', `/api/shops/${shopA.id}/clicks/page?page=${encodeURIComponent('/checkout/:id')}`);
    assert.equal(page.json.depth.length, 10);
    const o = await A.call('GET', `/api/shops/${shopA.id}/overview`);
    const rec = o.json.recommendations.find((x: any) => x.id.startsWith('rage-'));
    assert.ok(rec, JSON.stringify(o.json.recommendations.map((x: any) => x.id)));
    assert.match(rec.why, /Betroffene Sessions kaufen zu 10 %, Sessions auf derselben Seite ohne dieses Problem zu 50 %/);
  });
});

describe('Heatmap-Link und Datenzugriff', () => {
  test('signierter Link liefert Punkte nur für genau diesen Shop', async () => {
    const link = await A.call('POST', `/api/shops/${shopA.id}/clicks/heatmap-link`, { page: '/checkout/:id' });
    assert.equal(link.status, 200);
    const pub = new Client();
    const ok = await pub.call('GET', `/api/public/heatmap?key=${shopA.public_key}&token=${encodeURIComponent(link.json.token)}`);
    assert.equal(ok.status, 200);
    assert.ok(ok.json.points.length > 0);
    assert.equal(ok.json.elements[0].selector, '#voucher-apply');
    // gleicher Token mit dem Key eines anderen Shops -> abgelehnt
    assert.equal((await pub.call('GET', `/api/public/heatmap?key=${shopB.public_key}&token=${encodeURIComponent(link.json.token)}`)).status, 403);
    // manipuliert / abgelaufen -> abgelehnt
    const tampered = link.json.token.replace(/.$/, (c: string) => (c === 'A' ? 'B' : 'A'));
    assert.equal((await pub.call('GET', `/api/public/heatmap?key=${shopA.public_key}&token=${encodeURIComponent(tampered)}`)).status, 403);
    const expired = signToken('heatmap', { s: shopA.id, p: '/checkout/:id', d: null, n: 30 }, -10);
    assert.equal((await pub.call('GET', `/api/public/heatmap?key=${shopA.public_key}&token=${encodeURIComponent(expired)}`)).status, 403);
    // Token fuer einen anderen Zweck (z. B. andere Signatur) gilt nicht
    const other = signToken('anderer-zweck', { s: shopA.id, p: '/checkout/:id', d: null, n: 30 }, 600);
    assert.equal((await pub.call('GET', `/api/public/heatmap?key=${shopA.public_key}&token=${encodeURIComponent(other)}`)).status, 403);
  });

  test('fremde Organisation: keine Klickdaten, kein Heatmap-Link', async () => {
    assert.equal((await B.call('GET', `/api/shops/${shopA.id}/clicks`)).status, 404);
    assert.equal((await B.call('GET', `/api/shops/${shopA.id}/clicks/page?page=/checkout/:id`)).status, 404);
    assert.equal((await B.call('POST', `/api/shops/${shopA.id}/clicks/heatmap-link`, { page: '/checkout/:id' })).status, 404);
  });

  test('Lesezugriff darf Heatmap-Links erzeugen', async () => {
    await A.call('POST', '/api/org/invitations', { email: 'leser@ck.de', role: 'viewer' });
    const { outbox } = await import('../mail.js');
    const token = outbox.at(-1)!.text.match(/token=([\w-]+)/)![1];
    const viewer = new Client();
    await viewer.call('POST', '/api/auth/invitation/accept', { token, password: 'leser-geheim-1' });
    assert.equal((await viewer.call('POST', `/api/shops/${shopA.id}/clicks/heatmap-link`, { page: '/checkout/:id' })).status, 200);
  });
});

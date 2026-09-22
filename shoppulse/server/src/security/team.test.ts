import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

process.env.SHOPPULSE_DB = ':memory:';
process.env.SHOPPULSE_MAIL_MODE = 'memory';
process.env.SHOPPULSE_COOKIE_SECURE = '1';
process.env.SHOPPULSE_LOGIN_MAX_ATTEMPTS = '5';
process.env.SHOPPULSE_PUBLIC_URL = 'https://app.shoppulse.test';
const { createApp } = await import('../app.js');
const { outbox } = await import('../mail.js');
const { db, readSourceConfig, writeSourceConfig, reencryptSourceConfigs } = await import('../db/index.js');
const { decryptSecret, encryptSecret } = await import('./secrets.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let server: Server;
let base = '';

class Client {
  cookie = '';
  async call(method: string, p: string, body?: unknown) {
    const res = await fetch(base + p, {
      method,
      headers: {
        'X-Requested-With': 'ShopPulse',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
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
    return { status: res.status, json, text, headers: res.headers };
  }
}

const tokenFromMail = (to: string) => {
  const mail = [...outbox].reverse().find((m) => m.to === to);
  assert.ok(mail, `keine Mail an ${to}`);
  const m = mail.text.match(/token=([A-Za-z0-9_-]+)/);
  assert.ok(m);
  return { token: m[1], mail };
};

const ownerA = new Client();
const ownerB = new Client();
let shopA: any;

before(async () => {
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let r = await ownerA.call('POST', '/api/auth/register', { email: 'inhaber@a.de', password: 'sehr-geheim-123', organization: 'Firma A', name: 'Ina Inhaber' });
  assert.equal(r.status, 201);
  assert.match(r.headers.get('set-cookie')!, /; Secure/);
  r = await ownerA.call('POST', '/api/shops', { name: 'Shop A', domain: 'a-shop.de' });
  shopA = r.json;
  assert.equal((await ownerB.call('POST', '/api/auth/register', { email: 'inhaber@b.de', password: 'sehr-geheim-123', organization: 'Firma B' })).status, 201);
});
after(() => server.close());

async function invite(email: string, role: string) {
  const r = await ownerA.call('POST', '/api/org/invitations', { email, role });
  assert.equal(r.status, 201, r.text);
  const { token, mail } = tokenFromMail(email);
  assert.match(mail.text, /https:\/\/app\.shoppulse\.test\/einladung\?token=/);
  const c = new Client();
  const info = await c.call('GET', `/api/auth/invitation?token=${token}`);
  assert.equal(info.json.orgName, 'Firma A');
  const acc = await c.call('POST', '/api/auth/invitation/accept', { token, name: email, password: 'noch-geheimer-456' });
  assert.equal(acc.status, 201, acc.text);
  const me = await c.call('GET', '/api/auth/me');
  return { client: c, token, id: me.json.id as number };
}

describe('Team & Rollen', () => {
  let viewer: Awaited<ReturnType<typeof invite>>;
  let editor: Awaited<ReturnType<typeof invite>>;

  test('Einladung per E-Mail: neues Mitglied sieht die Shops der Organisation', async () => {
    viewer = await invite('leser@a.de', 'viewer');
    const shops = await viewer.client.call('GET', '/api/shops');
    assert.deepEqual(shops.json.map((s: any) => s.id), [shopA.id]);
    // Einladungslink ist nur einmal verwendbar
    const again = await new Client().call('POST', '/api/auth/invitation/accept', { token: viewer.token, password: 'noch-geheimer-456' });
    assert.equal(again.status, 400);
  });

  test('Lesezugriff: lesen ja, ändern nein – eigenes Passwort ändern ja', async () => {
    const c = viewer.client;
    assert.equal((await c.call('GET', `/api/shops/${shopA.id}/overview`)).status, 200);
    assert.equal((await c.call('POST', '/api/shops', { name: 'x', domain: 'x.de' })).status, 403);
    assert.equal((await c.call('POST', `/api/shops/${shopA.id}/experiments`, { nudgeType: 'scarcity' })).status, 403);
    assert.equal((await c.call('DELETE', `/api/shops/${shopA.id}`)).status, 403);
    assert.equal((await c.call('POST', '/api/org/invitations', { email: 'y@a.de', role: 'owner' })).status, 403);
    const pw = await c.call('POST', '/api/auth/password/change', { currentPassword: 'noch-geheimer-456', newPassword: 'ganz-neues-789' });
    assert.equal(pw.status, 200);
  });

  test('Bearbeiten: Daten ändern ja, Shops löschen und Team verwalten nein', async () => {
    editor = await invite('redaktion@a.de', 'editor');
    const c = editor.client;
    assert.equal((await c.call('POST', `/api/shops/${shopA.id}/experiments`, { nudgeType: 'scarcity' })).status, 201);
    assert.equal((await c.call('DELETE', `/api/shops/${shopA.id}`)).status, 403);
    assert.equal((await c.call('POST', '/api/org/invitations', { email: 'z@a.de', role: 'viewer' })).status, 403);
    assert.equal((await c.call('PATCH', `/api/org/members/${viewer.id}`, { role: 'owner' })).status, 403);
  });

  test('Rollenwechsel wirkt sofort', async () => {
    assert.equal((await ownerA.call('PATCH', `/api/org/members/${editor.id}`, { role: 'viewer' })).status, 200);
    assert.equal((await editor.client.call('POST', `/api/shops/${shopA.id}/experiments`, { nudgeType: 'anchoring' })).status, 403);
    assert.equal((await ownerA.call('PATCH', `/api/org/members/${editor.id}`, { role: 'editor' })).status, 200);
  });

  test('Letzte:r Inhaber:in kann weder herabgestuft noch entfernt werden', async () => {
    const me = await ownerA.call('GET', '/api/auth/me');
    assert.equal((await ownerA.call('PATCH', `/api/org/members/${me.json.id}`, { role: 'viewer' })).status, 400);
    assert.equal((await ownerA.call('DELETE', `/api/org/members/${me.json.id}`)).status, 400);
  });

  test('Andere Organisation kann Mitglieder und Einladungen von A weder sehen noch ändern', async () => {
    const list = await ownerB.call('GET', '/api/org/members');
    assert.ok(!list.text.includes('@a.de'));
    assert.equal((await ownerB.call('PATCH', `/api/org/members/${editor.id}`, { role: 'owner' })).status, 404);
    assert.equal((await ownerB.call('DELETE', `/api/org/members/${editor.id}`)).status, 404);
    await ownerA.call('POST', '/api/org/invitations', { email: 'offen@a.de', role: 'viewer' });
    const inv = (await ownerA.call('GET', '/api/org/members')).json.invitations[0];
    assert.equal((await ownerB.call('DELETE', `/api/org/invitations/${inv.id}`)).status, 404);
    assert.equal((await ownerA.call('GET', '/api/org/members')).json.invitations.length, 1);
  });

  test('Entfernte Mitglieder verlieren sofort den Zugriff', async () => {
    assert.equal((await ownerA.call('DELETE', `/api/org/members/${editor.id}`)).status, 204);
    assert.equal((await editor.client.call('GET', '/api/shops')).status, 401);
  });
});

describe('Passwort vergessen / zurücksetzen', () => {
  test('gleiche Antwort für bekannte und unbekannte Adressen; Mail nur bei bekanntem Konto', async () => {
    const before = outbox.length;
    const c = new Client();
    const unknown = await c.call('POST', '/api/auth/password/forgot', { email: 'gibtsnicht@a.de' });
    const known = await c.call('POST', '/api/auth/password/forgot', { email: 'leser@a.de' });
    assert.equal(unknown.status, 200);
    assert.deepEqual(unknown.json, known.json);
    assert.equal(outbox.length, before + 1);
  });

  test('Reset-Link: setzt Passwort, beendet alle Sessions, ist nur einmal gültig', async () => {
    const old = new Client();
    assert.equal((await old.call('POST', '/api/auth/login', { email: 'leser@a.de', password: 'ganz-neues-789' })).status, 200);
    await new Client().call('POST', '/api/auth/password/forgot', { email: 'leser@a.de' });
    const { token, mail } = tokenFromMail('leser@a.de');
    assert.match(mail.text, /https:\/\/app\.shoppulse\.test\/passwort-zuruecksetzen\?token=/);
    const c = new Client();
    assert.equal((await c.call('POST', '/api/auth/password/reset', { token, password: 'nach-dem-reset-1' })).status, 200);
    assert.equal((await old.call('GET', '/api/shops')).status, 401, 'alte Session muss ungültig sein');
    assert.equal((await c.call('GET', '/api/shops')).status, 200);
    assert.equal((await new Client().call('POST', '/api/auth/password/reset', { token, password: 'nochmal-reset-2' })).status, 400);
    assert.equal((await new Client().call('POST', '/api/auth/login', { email: 'leser@a.de', password: 'nach-dem-reset-1' })).status, 200);
  });

  test('abgelaufene Reset-Links werden abgelehnt', async () => {
    await new Client().call('POST', '/api/auth/password/forgot', { email: 'inhaber@a.de' });
    const { token } = tokenFromMail('inhaber@a.de');
    db.prepare(`UPDATE password_resets SET expires_at = datetime('now', '-1 minute')`).run();
    assert.equal((await new Client().call('POST', '/api/auth/password/reset', { token, password: 'abgelaufen-123' })).status, 400);
  });
});

describe('Brute-Force-Sperre', () => {
  test('wird in der Datenbank gespeichert und greift nach 5 Fehlversuchen', async () => {
    const c = new Client();
    for (let i = 0; i < 5; i++) {
      assert.equal((await c.call('POST', '/api/auth/login', { email: 'inhaber@b.de', password: 'falsch' + i })).status, 401);
    }
    assert.equal((await c.call('POST', '/api/auth/login', { email: 'inhaber@b.de', password: 'sehr-geheim-123' })).status, 429);
    const row = db.prepare(`SELECT count FROM auth_attempts WHERE key = 'login-mail:inhaber@b.de'`).get() as { count: number };
    assert.equal(row.count, 5);
    db.prepare('DELETE FROM auth_attempts').run();
  });
});

describe('Verschlüsselte Zugangsdaten', () => {
  test('liegen nie im Klartext in der Datenbank und werden in der API maskiert', async () => {
    const secret = 'shpat_supergeheim_1234';
    db.prepare(`INSERT INTO inventory_sources (shop_id, name, type, config) VALUES (?, 'Shopify', 'shopify', ?)`).run(
      shopA.id,
      writeSourceConfig({ shopDomain: 'a.myshopify.com', accessToken: secret }),
    );
    const raw = db.prepare(`SELECT config FROM inventory_sources WHERE shop_id = ? AND type = 'shopify'`).get(shopA.id) as { config: string };
    assert.ok(raw.config.startsWith('enc:v1:'));
    assert.ok(!raw.config.includes(secret) && !raw.config.includes('myshopify'));
    assert.equal(readSourceConfig(raw.config).accessToken, secret);

    const inv = await ownerA.call('GET', `/api/shops/${shopA.id}/inventory`);
    assert.ok(!inv.text.includes(secret));
    assert.match(inv.text, /••••1234/);
  });

  test('Manipulation am Chiffrat wird erkannt', () => {
    const enc = encryptSecret('geheim');
    const parts = enc.split(':');
    parts[5] = Buffer.from('xxxxxx').toString('base64url');
    assert.throws(() => decryptSecret(parts.join(':')));
  });

  test('Klartext aus älteren Versionen wird beim Start verschlüsselt', () => {
    db.prepare(`INSERT INTO inventory_sources (shop_id, name, type, config) VALUES (?, 'Alt', 'csv_url', ?)`).run(
      shopA.id,
      JSON.stringify({ url: 'https://erp.example.de/b.csv', authHeader: 'Bearer alt' }),
    );
    assert.ok(reencryptSourceConfigs() >= 1);
    const rows = db.prepare('SELECT config FROM inventory_sources').all() as { config: string }[];
    assert.ok(rows.every((r) => r.config.startsWith('enc:v1:')));
  });
});

describe('Produktivbetrieb', () => {
  test('HSTS-Header, sobald Cookies nur per HTTPS laufen', async () => {
    const r = await new Client().call('GET', '/api/health');
    assert.match(r.headers.get('strict-transport-security') ?? '', /max-age=31536000/);
  });

  test('Server startet im Produktivmodus nicht ohne sichere Konfiguration', () => {
    const r = spawnSync(process.execPath, ['--import', 'tsx', path.join(__dirname, '../index.ts')], {
      env: { PATH: process.env.PATH, NODE_ENV: 'production', SHOPPULSE_DB: ':memory:' },
      encoding: 'utf-8',
      timeout: 30_000,
    });
    assert.equal(r.status, 1, r.stderr);
    for (const v of ['SHOPPULSE_SECRET_KEY', 'SHOPPULSE_PUBLIC_URL', 'SHOPPULSE_SMTP_URL', 'SHOPPULSE_TRUST_PROXY']) {
      assert.match(r.stderr, new RegExp(v));
    }
  });
});

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

process.env.SHOPPULSE_DB = ':memory:';
process.env.SHOPPULSE_MAIL_MODE = 'memory';
process.env.SHOPPULSE_LOGIN_MAX_ATTEMPTS = '1000';
const { createApp } = await import('../app.js');
const { db, invalidateEvents } = await import('../db/index.js');
const { combine, logRiskRatio, randomEffects, toLift } = await import('./meta.js');
const sw = await import('./swarm.js');
const { runAutopilot } = await import('../autopilot/engine.js');

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
const shop = (id: number) => db.prepare('SELECT * FROM shops WHERE id = ?').get(id) as any;

/** Fremde Netzwerk-Beitraege (echte Daten, is_demo = 0) */
function addNetworkShops(niche: string, count: number, nudge: string, segment: string, lift: number) {
  const ins = db.prepare(
    `INSERT INTO swarm_results (source_hash, is_demo, niche, nudge_type, segment, control_visitors, control_conversions, treatment_visitors, treatment_conversions, month)
     VALUES (?, 0, ?, ?, ?, 5000, 250, 5000, ?, '2026-09')`,
  );
  for (let i = 0; i < count; i++) ins.run(crypto.randomBytes(8).toString('hex'), niche, nudge, segment, Math.round(250 * (1 + lift)));
}

before(async () => {
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await A.call('POST', '/api/auth/register', { email: 'a@sw.de', password: 'sehr-geheim-123', organization: 'A' });
  await B.call('POST', '/api/auth/register', { email: 'b@sw.de', password: 'sehr-geheim-123', organization: 'B' });
  shopA = (await A.call('POST', '/api/shops', { name: 'Shop A', domain: 'a.de', niche: 'mode' })).json;
  shopB = (await B.call('POST', '/api/shops', { name: 'Shop B', domain: 'b.de', niche: 'mode' })).json;
});
after(() => server.close());

describe('Statistik', () => {
  test('log RR und Random-Effects: identische Studien -> tau² = 0, Effekt exakt', () => {
    const e = logRiskRatio({ controlVisitors: 1000, controlConversions: 100, treatmentVisitors: 1000, treatmentConversions: 120 })!;
    assert.ok(Math.abs(toLift(e.logRR) - 0.2) < 1e-9);
    const m = randomEffects([e, e, e, e])!;
    assert.equal(m.tau2, 0);
    assert.ok(Math.abs(m.mu - e.logRR) < 1e-12);
    assert.ok(Math.abs(m.se - Math.sqrt(e.variance / 4)) < 1e-12);
  });

  test('heterogene Studien -> tau² > 0 und breitere Vorhersage', () => {
    const mk = (x: number) => logRiskRatio({ controlVisitors: 20000, controlConversions: 1000, treatmentVisitors: 20000, treatmentConversions: x })!;
    const m = randomEffects([mk(1000), mk(1300), mk(900), mk(1400)])!;
    assert.ok(m.tau2 > 0);
    assert.ok(m.predictiveVariance > m.se ** 2);
  });

  test('Vorwissen verliert mit wachsenden eigenen Daten an Gewicht', () => {
    const prior = { mean: Math.log(1.1), variance: 0.01 };
    const small = combine(prior, logRiskRatio({ controlVisitors: 200, controlConversions: 10, treatmentVisitors: 200, treatmentConversions: 11 }));
    const large = combine(prior, logRiskRatio({ controlVisitors: 50000, controlConversions: 2500, treatmentVisitors: 50000, treatmentConversions: 2750 }));
    assert.ok(small.ownWeight < 0.2 && large.ownWeight > 0.7, `${small.ownWeight} / ${large.ownWeight}`);
  });
});

describe('Teilnahme, Anonymität und Trennung', () => {
  test('ohne Teilnahme keine Auswertungen (Geben und Nehmen)', async () => {
    addNetworkShops('mode', 6, 'social_proof', 'all', 0.15);
    const r = await A.call('GET', `/api/shops/${shopA.id}/swarm`);
    assert.equal(r.json.participating, false);
    assert.equal(r.json.benchmarks, null);
    assert.equal(r.json.evidence, null);
    assert.equal(sw.getPrior(shop(shopA.id), 'social_proof'), null);
  });

  test('nur Inhaber:innen entscheiden über die Teilnahme; fremde Organisationen gar nicht', async () => {
    await A.call('POST', '/api/org/invitations', { email: 'ed@sw.de', role: 'editor' });
    const { outbox } = await import('../mail.js');
    const token = outbox.at(-1)!.text.match(/token=([\w-]+)/)![1];
    const editor = new Client();
    await editor.call('POST', '/api/auth/invitation/accept', { token, password: 'editor-geheim-1' });
    assert.equal((await editor.call('PUT', `/api/shops/${shopA.id}/swarm`, { participate: true })).status, 403);
    assert.equal((await B.call('PUT', `/api/shops/${shopA.id}/swarm`, { participate: true })).status, 404);
    assert.equal((await B.call('GET', `/api/shops/${shopA.id}/swarm`)).status, 404);
    assert.equal((await A.call('PUT', `/api/shops/${shopA.id}/swarm`, { participate: true })).status, 200);
  });

  test('Vorwissen erst ab Mindestanzahl Shops; eigene Beiträge zählen nie mit', async () => {
    const s = shop(shopA.id);
    const p = sw.getPrior(s, 'social_proof')!;
    assert.equal(p.shops, 6);
    assert.ok(Math.abs(p.lift - 0.15) < 0.02);
    addNetworkShops('mode', 4, 'scarcity', 'all', 0.1);
    assert.equal(sw.getPrior(s, 'scarcity'), null, '4 Shops < 5');
    // Eigener Beitrag darf das eigene Vorwissen nicht beeinflussen
    db.prepare(
      `INSERT INTO swarm_results (source_hash, is_demo, niche, nudge_type, segment, control_visitors, control_conversions, treatment_visitors, treatment_conversions, month)
       VALUES (?, 0, 'mode', 'scarcity', 'all', 5000, 250, 5000, 500, '2026-09')`,
    ).run(sw.sourceHash(s));
    assert.equal(sw.getPrior(s, 'scarcity'), null, 'eigener Beitrag macht keinen 5. Shop');
  });

  test('Demo-Netzwerk und echte Daten sind strikt getrennt', async () => {
    const { seedDemoNetwork } = await import('../db/demoData.js');
    seedDemoNetwork();
    const s = shop(shopA.id);
    // echte Shops in "mode" sehen nur die 6 echten Beitraege, nicht die 24 Demo-Shops
    assert.equal(sw.getPrior(s, 'social_proof')!.shops, 6);
    const bench = sw.getBenchmarks(s)!;
    assert.equal(bench.available, false);
  });

  test('Widerruf löscht alle Beiträge des Shops', async () => {
    const s = shop(shopA.id);
    const hash = sw.sourceHash(s)!;
    assert.ok((db.prepare('SELECT COUNT(*) as n FROM swarm_results WHERE source_hash = ?').get(hash) as any).n > 0);
    const r = await A.call('PUT', `/api/shops/${shopA.id}/swarm`, { participate: false });
    assert.ok(r.json.removed > 0);
    assert.equal((db.prepare('SELECT COUNT(*) as n FROM swarm_results WHERE source_hash = ?').get(hash) as any).n, 0);
    assert.equal(sw.sourceHash(shop(shopA.id)), null);
    await A.call('PUT', `/api/shops/${shopA.id}/swarm`, { participate: true });
    assert.notEqual(sw.sourceHash(shop(shopA.id)), hash, 'neuer Token -> nicht mit alten Beiträgen verknüpfbar');
  });
});

describe('Schnellere Tests und Segment-Targeting', () => {
  function seed(shopId: number, expId: number, perSegment: Record<string, [number, number]>, n: number) {
    // Besucher mit Verhalten, das einem Segment entspricht (preissensibel vs. zoegernd)
    const ins = db.prepare(
      `INSERT INTO events (shop_id, visitor_id, session_id, type, page_type, sku, value, experiment_id, variant, ts)
       VALUES (?, ?, ?, ?, 'product', ?, ?, ?, ?, datetime('now', '-1 day', ?))`,
    );
    let k = 0;
    db.transaction(() => {
      for (const [segment, [ra, rb]] of Object.entries(perSegment)) {
        for (const [variant, rate] of [['control', ra], ['treatment', rb]] as const) {
          for (let i = 0; i < n; i++) {
            const v = `${segment}-${variant}-${expId}-${i}-xxxxxxxx`;
            const t = (m: number) => `+${m} seconds`;
            ins.run(shopId, v, v, 'exposure', 'P1', null, expId, variant, t(1));
            if (segment === 'price_sensitive') {
              ins.run(shopId, v, v, 'price_filter', null, null, null, null, t(2));
              for (const sku of ['P1', 'P2', 'P3', 'P4']) ins.run(shopId, v, v, 'page_view', sku, null, null, null, t(3));
            } else {
              ins.run(shopId, v, v, 'page_view', 'P1', null, null, null, t(2));
              ins.run(shopId, v, v, 'hesitation', 'P1', 3000, null, null, t(3));
              ins.run(shopId, v, v, 'hesitation', 'P1', 3000, null, null, t(4));
            }
            if (i < n * rate) ins.run(shopId, v, v, 'purchase', null, 50, null, null, t(10));
            k++;
          }
        }
      }
    })();
    invalidateEvents(shopId);
  }

  test('mit Schwarmwissen wird ein Gewinner früher erkannt – und nur für Segmente mit Nutzen ausgerollt', async () => {
    const s = shop(shopA.id);
    addNetworkShops('mode', 8, 'anchoring', 'all', 0.2);
    addNetworkShops('mode', 8, 'anchoring', 'price_sensitive', 0.35);
    addNetworkShops('mode', 8, 'anchoring', 'hesitant', -0.05);
    await A.call('PUT', `/api/shops/${shopA.id}/autopilot`, { enabled: true, mode: 'auto' });
    const expId = Number(
      db
        .prepare(
          `INSERT INTO experiments (shop_id, name, nudge_type, page_type, config, status, started_at, created_by_autopilot)
           VALUES (?, 'AP Anchoring', 'anchoring', 'product', '{}', 'running', datetime('now', '-2 days'), 1)`,
        )
        .run(s.id).lastInsertRowid,
    );
    // eigener Test: preissensibel profitiert, zoegernd nicht; allein (noch) nicht signifikant genug
    seed(s.id, expId, { price_sensitive: [0.1, 0.13], hesitant: [0.1, 0.098] }, 400);
    const exp = db.prepare('SELECT * FROM experiments WHERE id = ?').get(expId) as any;
    const { analyzeExperiment } = await import('../analytics/experiments.js');
    const { recentEvents } = await import('../db/index.js');
    const a = analyzeExperiment(exp, recentEvents(s.id, 90));
    assert.equal(a.verdict, 'collecting', 'ohne Schwarm noch keine Entscheidung');
    const assessment = sw.assessExperiment(s, exp, a)!;
    assert.equal(assessment.earlyDecision, 'winner');

    const r = runAutopilot(s);
    assert.ok(r.actions.some((x) => x.action === 'rollout' && /früher entschieden/.test(x.title)), JSON.stringify(r.actions));
    const rollout = db.prepare(`SELECT * FROM nudge_rollouts WHERE shop_id = ? AND nudge_type = 'anchoring'`).get(s.id) as any;
    const segments = JSON.parse(rollout.target_segments);
    assert.ok(segments.includes('price_sensitive'));
    assert.ok(!segments.includes('hesitant'), 'zögernd ohne Nutzen -> ausgenommen');
  });

  test('Snippet bekommt Segment und Zielsegmente – ausgenommene Besucher:innen sehen den Nudge nicht', async () => {
    const pub = new Client();
    const priceVisitor = 'price_sensitive-treatment-0-1-xxxxxxxx';
    const hesitantVisitor = 'hesitant-treatment-0-1-xxxxxxxx';
    const expId = (db.prepare(`SELECT id FROM experiments WHERE name = 'AP Anchoring'`).get() as any).id;
    const cfg = async (v: string) =>
      (await pub.call('GET', `/api/public/config?key=${shopA.public_key}&pageType=product&sku=P1&visitor=${v.replace('-0-', `-${expId}-`)}`)).json;
    const c1 = await cfg(priceVisitor);
    const c2 = await cfg(hesitantVisitor);
    assert.equal(c1.segment, 'price_sensitive');
    assert.equal(c2.segment, 'hesitant');
    const anchoring = c1.rollouts.find((x: any) => x.type === 'anchoring');
    assert.ok(anchoring.segments.includes('price_sensitive') && !anchoring.segments.includes('hesitant'));
  });

  test('ungültige Zielsegmente werden abgewiesen; fremde Organisation kann Rollouts nicht ändern', async () => {
    const rollout = db.prepare(`SELECT id FROM nudge_rollouts WHERE shop_id = ?`).get(shopA.id) as any;
    assert.equal((await A.call('PATCH', `/api/rollouts/${rollout.id}`, { segments: ['gibtsnicht'] })).status, 400);
    assert.equal((await B.call('PATCH', `/api/rollouts/${rollout.id}`, { segments: null })).status, 404);
    assert.equal((await A.call('PATCH', `/api/rollouts/${rollout.id}`, { segments: null })).status, 200);
    assert.equal((await A.call('POST', `/api/shops/${shopA.id}/experiments`, { nudgeType: 'scarcity', targetSegments: ['x'] })).status, 400);
  });

  test('beendete Tests fließen automatisch ins Schwarmwissen', () => {
    const hash = sw.sourceHash(shop(shopA.id))!;
    const n = (db.prepare(`SELECT COUNT(*) as n FROM swarm_results WHERE source_hash = ? AND nudge_type = 'anchoring'`).get(hash) as any).n;
    assert.ok(n >= 2, `Beiträge: ${n}`);
  });
});

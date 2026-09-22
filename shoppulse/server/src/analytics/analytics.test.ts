import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalCdf, requiredSampleSize, twoProportionTest } from './stats.js';
import { estimateElasticity, matchOffer, recommendPrice } from './pricing.js';
import { classifyVisitor, visitorFeatures } from './segmentation.js';
import { analyzeExperiment } from './experiments.js';
import type { EventRow, ExperimentRow } from '../db/index.js';

test('normalCdf liefert bekannte Quantile', () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-7);
  assert.ok(Math.abs(normalCdf(1.959964) - 0.975) < 1e-4);
  assert.ok(Math.abs(normalCdf(-1.644854) - 0.05) < 1e-4);
});

test('Zwei-Stichproben-Test erkennt deutlichen Unterschied', () => {
  const r = twoProportionTest(100, 1000, 150, 1000);
  assert.ok(r.significant);
  assert.ok(Math.abs(r.relativeUplift! - 0.5) < 1e-9);
  assert.ok(r.ci95[0] > 0 && r.ci95[1] > r.ci95[0]);
});

test('Zwei-Stichproben-Test: kein Effekt bei gleichen Raten', () => {
  const r = twoProportionTest(50, 1000, 50, 1000);
  assert.equal(r.significant, false);
  assert.ok(Math.abs(r.pValue - 1) < 1e-6);
});

test('Stichprobengröße entspricht der Standardformel', () => {
  // 10 % Basis, +20 % relativ (10 % -> 12 %): Lehrbuchwert ca. 3.840 je Variante
  const n = requiredSampleSize(0.1, 0.2);
  assert.ok(n > 3700 && n < 4000, `n=${n}`);
  assert.equal(requiredSampleSize(0, 0.2), Infinity);
});

test('Elastizität wird aus Log-Log-Daten korrekt geschätzt', () => {
  const history = [0.8, 0.9, 1, 1.1, 1.2].map((f) => ({
    price: 50 * f,
    units_sold: Math.round(700 * Math.pow(f, -2)),
    period_days: 7,
  }));
  const e = estimateElasticity(history);
  assert.ok(e.reliable);
  assert.ok(Math.abs(e.elasticity! + 2) < 0.05, `e=${e.elasticity}`);
});

test('Elastizität: zu wenige Preispunkte -> keine Empfehlung, nur Test', () => {
  const r = recommendPrice({
    price: 50,
    unitCost: 20,
    history: [
      { price: 50, units_sold: 10, period_days: 7 },
      { price: 50, units_sold: 12, period_days: 7 },
    ],
    competitorPrices: [],
  });
  assert.equal(r.recommendation.action, 'test');
  assert.equal(r.recommendation.recommendedPrice, 50);
});

test('Preisempfehlung: unelastische Nachfrage -> Erhöhung, max. +10 %', () => {
  const history = [0.9, 1, 1.1, 0.95].map((f) => ({ price: 40 * f, units_sold: Math.round(500 * Math.pow(f, -0.5)), period_days: 7 }));
  const r = recommendPrice({ price: 40, unitCost: 15, history, competitorPrices: [41, 43] });
  assert.equal(r.recommendation.action, 'raise');
  assert.ok(r.recommendation.recommendedPrice <= 44 + 1e-9);
  assert.ok(r.recommendation.expectedProfitDeltaPerMonth > 0);
});

test('SKU-Matching: EAN vor Titel, Titel mit Schwellwert', () => {
  const products = [
    { id: 1, name: 'Regenjacke Nordlicht Damen', ean: '4006381333931' },
    { id: 2, name: 'Merino Shirt Basic', ean: null },
  ];
  assert.deepEqual(matchOffer({ title: 'irgendwas', ean: '4006381333931' }, products), {
    productId: 1,
    method: 'ean',
    confidence: 1,
  });
  assert.equal(matchOffer({ title: 'Merino Shirt Basic Herren', ean: null }, products)?.productId, 2);
  assert.equal(matchOffer({ title: 'Trekkingstöcke Carbon', ean: null }, products), null);
});

let seq = 0;
function ev(visitor: string, type: string, extra: Partial<EventRow> = {}): EventRow {
  seq += 1;
  return {
    id: seq,
    shop_id: 1,
    visitor_id: visitor,
    session_id: visitor + '-s',
    type,
    page_type: null,
    sku: null,
    value: null,
    experiment_id: null,
    variant: null,
    ts: `2026-09-01 10:${String(Math.floor(seq / 60) % 60).padStart(2, '0')}:${String(seq % 60).padStart(2, '0')}`,
    ...extra,
  };
}

test('Segmentierung: Preisfilter + Vergleiche -> preissensibel', () => {
  const events = [
    ev('a', 'page_view', { page_type: 'category' }),
    ev('a', 'price_filter'),
    ...['p1', 'p2', 'p3', 'p4'].map((sku) => ev('a', 'page_view', { page_type: 'product', sku })),
  ];
  const f = visitorFeatures(events).get('a')!;
  assert.equal(classifyVisitor(f).segment, 'price_sensitive');
});

test('Segmentierung nutzt nur Verhalten vor dem ersten Kauf', () => {
  const events = [
    ev('b', 'page_view', { page_type: 'product', sku: 'p1' }),
    ev('b', 'add_to_cart', { sku: 'p1' }),
    ev('b', 'purchase', { value: 50 }),
    // nach dem Kauf: viel Stoebern – darf die Zuordnung nicht beeinflussen
    ...Array.from({ length: 10 }, (_, i) => ev('b', 'page_view', { page_type: 'product', sku: `x${i}` })),
  ];
  const f = visitorFeatures(events).get('b')!;
  assert.equal(f.pageViews, 1);
  assert.equal(f.purchases, 1);
  assert.equal(classifyVisitor(f).segment, 'convenience');
});

test('Experiment-Auswertung zählt nur Käufe nach der Exposition', () => {
  const exp: ExperimentRow = {
    id: 7,
    shop_id: 1,
    name: 'SP',
    nudge_type: 'social_proof',
    page_type: 'product',
    config: '{}',
    status: 'running',
    traffic_split: 0.5,
    created_at: '2026-09-01 00:00:00',
    started_at: '2026-09-01 00:00:00',
    stopped_at: null,
  };
  const events = [
    ev('c', 'purchase', { value: 30 }), // vor Exposition -> zaehlt nicht
    ev('c', 'exposure', { experiment_id: 7, variant: 'control' }),
    ev('d', 'exposure', { experiment_id: 7, variant: 'treatment' }),
    ev('d', 'purchase', { value: 80 }),
  ];
  const a = analyzeExperiment(exp, events);
  assert.equal(a.control.visitors, 1);
  assert.equal(a.control.conversions, 0);
  assert.equal(a.treatment.conversions, 1);
  assert.equal(a.treatment.revenue, 80);
  assert.equal(a.verdict, 'collecting');
});

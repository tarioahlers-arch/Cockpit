import crypto from 'node:crypto';
import { db, getShop, writeSourceConfig, type ShopRow } from './index.js';
import { ingestInventory, type SourceRow } from '../inventory/ingest.js';
import { recordPush } from '../inventory/sync.js';

/**
 * Erzeugt einen Demo-Shop mit 30 Tagen synthetischer, klar als Demo gekennzeichneter Verhaltensdaten,
 * damit Segmentierung, A/B-Auswertung und Pricing ohne echten Shop ausprobiert werden koennen.
 */

// Deterministischer Zufall (mulberry32), damit Demo-Ergebnisse reproduzierbar sind
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Archetype = 'price_sensitive' | 'convenience' | 'hesitant' | 'explorer' | 'bounce';

const ARCHETYPES: { key: Archetype; share: number; buy: number }[] = [
  { key: 'price_sensitive', share: 0.26, buy: 0.05 },
  { key: 'convenience', share: 0.16, buy: 0.2 },
  { key: 'hesitant', share: 0.2, buy: 0.05 },
  { key: 'explorer', share: 0.23, buy: 0.012 },
  { key: 'bounce', share: 0.15, buy: 0 },
];

// Wirkung der Nudges je Archetyp (additiv auf die Kaufwahrscheinlichkeit) – Grundlage fuer das "Warum"
const SOCIAL_PROOF_EFFECT: Record<Archetype, number> = {
  price_sensitive: 0.004,
  convenience: 0.0,
  hesitant: 0.06,
  explorer: 0.012,
  bounce: 0,
};
const ANCHORING_EFFECT: Record<Archetype, number> = {
  price_sensitive: 0.012,
  convenience: -0.003,
  hesitant: 0.0,
  explorer: 0.0,
  bounce: 0,
};

/** Anteil der dauerhaften Kontrollgruppe in der Demo (hoeher als der Standard von 5 %, damit der
 *  Uplift-Nachweis mit den begrenzten Demo-Daten sichtbar wird) */
const DEMO_HOLDOUT = 0.15;

const PRODUCTS = [
  { sku: 'NL-JACKE-01', ean: '4006381333931', name: 'Regenjacke Nordlicht Damen', price: 129.9, cost: 52, stock: 6, elasticity: -1.4, baseUnits: 9 },
  { sku: 'NL-JACKE-02', ean: '4006381333948', name: 'Regenjacke Nordlicht Herren', price: 139.9, cost: 55, stock: 23, elasticity: -2.6, baseUnits: 7 },
  { sku: 'NL-SHIRT-01', ean: '4006381333955', name: 'Merino Shirt Basic', price: 49.9, cost: 14, stock: 80, elasticity: -0.7, baseUnits: 24 },
  { sku: 'NL-SOCKEN-3', ean: null, name: 'Wandersocken 3er-Pack', price: 19.9, cost: 6.5, stock: 140, elasticity: -1.8, baseUnits: 40 },
];

export function createDemoShop(orgId: number): ShopRow {
  const r = rng(42);
  const key = 'pk_demo_' + crypto.randomBytes(8).toString('hex');
  const shopId = Number(
    db
      .prepare(
        `INSERT INTO shops (name, domain, platform, niche, public_key, is_demo, org_id) VALUES (?, ?, 'shopify', 'mode', ?, 1, ?)`,
      )
      .run('Demo: Modehaus Nordlicht', 'nordlicht-demo.example', key, orgId).lastInsertRowid,
  );

  const now = Date.now();
  const tsAt = (msAgo: number) => new Date(now - Math.max(msAgo, 1000)).toISOString().slice(0, 19).replace('T', ' ');
  const DAY = 86_400_000;

  const run = db.transaction(() => {
    // --- Produkte, Preis-Historie, Wettbewerb ---------------------------------
    const insProduct = db.prepare(
      'INSERT INTO products (shop_id, sku, ean, name, price, unit_cost, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    const insHistory = db.prepare(
      'INSERT INTO price_history (product_id, price, units_sold, period_start, period_days) VALUES (?, ?, ?, ?, 7)',
    );
    const insOffer = db.prepare(
      `INSERT INTO competitor_offers (shop_id, competitor, title, ean, price, url, matched_product_id, match_method, match_confidence, observed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const p of PRODUCTS) {
      const productId = Number(insProduct.run(shopId, p.sku, p.ean, p.name, p.price, p.cost, p.stock).lastInsertRowid);
      // 8 Wochen mit Preisvariationen (Aktionen), Absatz folgt konstanter Elastizitaet + Rauschen
      const factors = [1, 0.9, 1, 1.05, 0.95, 1, 0.85, 1];
      factors.forEach((f, i) => {
        const price = Math.round(p.price * f * 100) / 100;
        const units = Math.max(1, Math.round(p.baseUnits * 7 * Math.pow(f, p.elasticity) * (0.92 + r() * 0.16)));
        insHistory.run(productId, price, units, tsAt((8 - i) * 7 * DAY).slice(0, 10));
      });
      if (p.ean) {
        insOffer.run(shopId, 'Outdoor-Profi.de', p.name, p.ean, Math.round(p.price * 0.94 * 100) / 100, null, productId, 'ean', 1, tsAt(DAY));
      }
      insOffer.run(
        shopId,
        'Bergsport24',
        p.name.replace('Nordlicht ', ''),
        null,
        Math.round(p.price * (1.02 + r() * 0.08) * 100) / 100,
        null,
        productId,
        'title',
        0.75,
        tsAt(DAY),
      );
    }
    insOffer.run(shopId, 'Bergsport24', 'Trekkingstöcke Carbon Paar', null, 89.0, null, null, null, null, tsAt(DAY));

    // --- Experimente ------------------------------------------------------
    const insExp = db.prepare(
      `INSERT INTO experiments (shop_id, name, nudge_type, page_type, config, status, traffic_split, created_at, started_at, stopped_at, created_by_autopilot)
       VALUES (?, ?, ?, 'product', ?, ?, 0.5, ?, ?, ?, 1)`,
    );
    const spId = Number(
      insExp.run(
        shopId,
        'Autopilot: Social Proof (Kaufzahlen)',
        'social_proof',
        JSON.stringify({ windowHours: 48, minCount: 3, template: '{count}× in den letzten {hours} Stunden gekauft' }),
        'running',
        tsAt(29 * DAY),
        tsAt(29 * DAY),
        null,
      ).lastInsertRowid,
    );
    const anchorId = Number(
      insExp.run(
        shopId,
        'Autopilot: Anchoring (Referenzpreis)',
        'anchoring',
        JSON.stringify({ template: 'Statt {reference} € – Sie sparen {savingPct} %' }),
        'stopped',
        tsAt(29 * DAY),
        tsAt(29 * DAY),
        tsAt(2 * DAY),
      ).lastInsertRowid,
    );

    // Autopilot ist eingeschaltet und hat beide Tests selbst gestartet (Historie im Protokoll)
    db.prepare(
      `INSERT INTO autopilot_settings (shop_id, enabled, mode, holdout_share, updated_at, last_run_at) VALUES (?, 1, 'auto', ?, ?, ?)`,
    ).run(shopId, DEMO_HOLDOUT, tsAt(30 * DAY), tsAt(2 * DAY));
    const insLog = db.prepare(
      'INSERT INTO autopilot_log (shop_id, action, title, reason, experiment_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    insLog.run(shopId, 'settings', 'Autopilot eingeschaltet (startet Tests selbst)', 'durch Demo-Konto', null, tsAt(30 * DAY));
    insLog.run(
      shopId,
      'test_started',
      'Test gestartet: Anchoring (Referenzpreis)',
      'Grundlage: „Referenzpreise für preissensible Besucher:innen sichtbar machen“ – rund ein Viertel der Besucher:innen zeigt preissensibles Verhalten.',
      anchorId,
      tsAt(29 * DAY),
    );
    insLog.run(
      shopId,
      'test_started',
      'Test gestartet: Social Proof (Kaufzahlen)',
      'Grundlage: „Warenkorbabbrüche mit Social Proof adressieren“ – über 70 % der Warenkörbe werden abgebrochen.',
      spId,
      tsAt(29 * DAY),
    );
    insLog.run(
      shopId,
      'stopped_inconclusive',
      'Test ohne Effekt beendet: Autopilot: Anchoring (Referenzpreis)',
      'Die geplante Stichprobe ist erreicht, ein Effekt von mindestens 20 % relativ war nicht messbar. Der nächste Test kann starten.',
      anchorId,
      tsAt(2 * DAY),
    );

    // --- Besucher & Ereignisse -------------------------------------------
    const insEvent = db.prepare(
      `INSERT INTO events (shop_id, visitor_id, session_id, type, page_type, sku, value, experiment_id, variant, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const pickArchetype = (): (typeof ARCHETYPES)[number] => {
      let x = r();
      for (const a of ARCHETYPES) {
        if ((x -= a.share) <= 0) return a;
      }
      return ARCHETYPES[ARCHETYPES.length - 1];
    };
    const id = () => Math.floor(r() * 0xffffffffffff).toString(16).padStart(12, '0') + Math.floor(r() * 0xffff).toString(16).padStart(4, '0');

    const VISITORS = 12000;
    for (let v = 0; v < VISITORS; v++) {
      const a = pickArchetype();
      const visitorId = id();
      const sessionCount = a.key === 'bounce' ? 1 : 1 + Math.floor(r() * (a.key === 'explorer' ? 3 : 2));
      let t = 1 + r() * 28 * DAY + DAY; // Startzeitpunkt vor bis zu 29 Tagen
      // Dauerhafte Kontrollgruppe: sieht nie Nudges (Grundlage des Uplift-Nachweises)
      const holdout = r() < DEMO_HOLDOUT;
      let groupSent = false;
      let variantSP: 'control' | 'treatment' | null = null;
      let variantAnchor: 'control' | 'treatment' | null = null;
      let bought = false;

      for (let s = 0; s < sessionCount; s++) {
        const sessionId = id();
        const ev = (type: string, pageType: string | null, sku: string | null = null, value: number | null = null, exp: number | null = null, variant: string | null = null) => {
          insEvent.run(shopId, visitorId, sessionId, type, pageType, sku, value, exp, variant, tsAt(t));
          t -= 20_000 + r() * 60_000;
        };

        if (!groupSent) {
          ev('group', null, null, null, null, holdout ? 'holdout' : 'exposed');
          groupSent = true;
        }
        ev('page_view', r() < 0.5 ? 'home' : 'category');
        if (a.key === 'bounce') {
          ev('scroll_depth', 'home', null, 10 + r() * 20);
          break;
        }

        const product = PRODUCTS[Math.floor(r() * PRODUCTS.length)];
        const views =
          a.key === 'convenience' ? 1 : a.key === 'explorer' ? 4 + Math.floor(r() * 7) : a.key === 'price_sensitive' ? 3 + Math.floor(r() * 4) : 1 + Math.floor(r() * 3);
        if (a.key === 'price_sensitive') ev('price_filter', 'category');
        for (let i = 0; i < views; i++) {
          const p = i === views - 1 ? product : PRODUCTS[Math.floor(r() * PRODUCTS.length)];
          ev('page_view', 'product', p.sku);
          const sku = p.sku;
          // Experimente laufen auf Produktseiten; Zuweisung stabil je Besucher
          if (!holdout) {
            if (variantSP === null) variantSP = r() < 0.5 ? 'control' : 'treatment';
            if (variantAnchor === null) variantAnchor = r() < 0.5 ? 'control' : 'treatment';
            ev('exposure', 'product', sku, null, spId, variantSP);
            ev('exposure', 'product', sku, null, anchorId, variantAnchor);
          }
          ev('scroll_depth', 'product', sku, a.key === 'explorer' ? 70 + r() * 30 : 25 + r() * 50);
          if ((a.key === 'hesitant' && r() < 0.7) || (a.key === 'price_sensitive' && r() < 0.35)) {
            ev('hesitation', 'product', sku, 2000 + r() * (a.key === 'price_sensitive' ? 7000 : 4000));
          }
        }

        const pBuy =
          a.buy +
          (variantSP === 'treatment' ? SOCIAL_PROOF_EFFECT[a.key] : 0) +
          (variantAnchor === 'treatment' ? ANCHORING_EFFECT[a.key] : 0);
        const willBuy = !bought && r() < pBuy * 1.0;
        const addsToCart = willBuy || (a.key === 'hesitant' && r() < 0.55) || (a.key === 'price_sensitive' && r() < 0.15) || r() < 0.03;

        if (addsToCart) {
          ev('add_to_cart', 'product', product.sku);
          if (willBuy || r() < 0.4) {
            ev('page_view', 'checkout');
            ev('checkout_start', 'checkout');
          }
          if (willBuy) {
            const value = Math.round(product.price * (1 + (r() < 0.3 ? 1 : 0)) * 100) / 100;
            ev('page_view', 'confirmation');
            ev('purchase', 'confirmation', null, value);
            ev('purchase_item', 'confirmation', product.sku);
            bought = true;
          }
        }
        t -= DAY * r();
        if (t < 60_000) break;
      }
    }
  });
  run();
  seedInventory(shopId);
  return getShop(shopId)!;
}

/**
 * Demo-Lagerintegration mit zwei unterschiedlichen "Tools":
 *  - ERP-Export als CSV-Feed (Pull, wird vom Scheduler regelmaessig abgerufen)
 *  - Kassensystem der Filialen per Push-API
 */
const DEMO_STOCK: { sku: string; central: number; hamburg: number; munich: number }[] = [
  { sku: 'NL-JACKE-01', central: 4, hamburg: 2, munich: 0 },
  { sku: 'NL-JACKE-02', central: 0, hamburg: 3, munich: 1 },
  { sku: 'NL-SHIRT-01', central: 80, hamburg: 12, munich: 9 },
  { sku: 'NL-SOCKEN-3', central: 140, hamburg: 30, munich: 25 },
  { sku: 'NL-MUETZE-01', central: 35, hamburg: 6, munich: 4 }, // im ERP, aber (noch) nicht als Produkt in ShopPulse
];

export function demoErpCsv(): string {
  return ['Artikelnummer;Bestand;Lager', ...DEMO_STOCK.map((r) => `${r.sku};${r.central};Zentrallager Hamburg`)].join('\n');
}

function seedInventory(shopId: number) {
  const port = process.env.PORT ?? '4100';
  const insert = db.prepare(
    'INSERT INTO inventory_sources (shop_id, name, type, config, sync_interval_min) VALUES (?, ?, ?, ?, ?)',
  );
  const erpId = Number(
    insert.run(
      shopId,
      'ERP-Export (CSV-Feed)',
      'csv_url',
      writeSourceConfig({ url: `http://localhost:${port}/demo-shop/${shopId}/erp-bestand.csv` }),
      15,
    ).lastInsertRowid,
  );
  const posId = Number(
    insert.run(shopId, 'Kassensystem Filialen (Push-API)', 'push', writeSourceConfig({}), 15).lastInsertRowid,
  );
  const source = (id: number) => db.prepare('SELECT * FROM inventory_sources WHERE id = ?').get(id) as SourceRow;

  // ERP: gleicher Stand, den der Feed liefert (Scheduler gleicht spaeter echt per HTTP ab)
  const erp = ingestInventory(
    source(erpId),
    { levels: DEMO_STOCK.map((r) => ({ sku: r.sku, quantity: r.central, location: 'Zentrallager Hamburg' })) },
    'snapshot',
  );
  recordPush(erpId, erp);

  const pos = ingestInventory(
    source(posId),
    {
      locations: [
        { externalId: 'FIL-HH', name: 'Filiale Hamburg', kind: 'store' },
        { externalId: 'FIL-MUC', name: 'Filiale München', kind: 'store' },
      ],
      levels: DEMO_STOCK.flatMap((r) => [
        { sku: r.sku, quantity: r.hamburg, location: 'FIL-HH' },
        { sku: r.sku, quantity: r.munich, location: 'FIL-MUC' },
      ]),
    },
    'snapshot',
  );
  recordPush(posId, pos);
}

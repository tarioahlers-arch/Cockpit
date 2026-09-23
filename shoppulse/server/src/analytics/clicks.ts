import { db, recentEvents } from '../db/index.js';

/**
 * Klick-Analyse & Frust-Signale.
 *  - Frust-Klick (rage_click): >= 3 Klicks innerhalb 1 s an derselben Stelle – Element reagiert
 *    nicht oder zu langsam, Nutzer:in ist ungeduldig/veraergert.
 *  - Klick ins Leere (dead_click): Klick auf ein nicht klickbares Element ohne Reaktion der Seite –
 *    Element sieht klickbar aus (Bild, Preis, Text), ist es aber nicht.
 *  - Hektisches Scrollen (scroll_thrash): schnelle Richtungswechsel – Orientierungslosigkeit.
 */

export interface ElementStat {
  selector: string;
  label: string | null;
  pageKey: string;
  clicks: number;
  rage: number;
  dead: number;
  sessions: number;
  rageSessions: number;
  deadSessions: number;
}

const FRUST_TYPES = ['rage_click', 'dead_click', 'scroll_thrash'];
/** Ab so vielen Klicks ins Leere gilt eine Session als frustriert */
export const MIN_DEAD_FOR_FRUST = 2;

export function frustrationSummary(shopId: number, days = 30) {
  const events = recentEvents(shopId, days);
  const sessions = new Map<string, { frust: boolean; bought: boolean; rage: boolean; dead: boolean; thrash: boolean }>();
  let rage = 0;
  let dead = 0;
  let thrash = 0;
  const deadCount = new Map<string, number>();
  for (const e of events) {
    const s = sessions.get(e.session_id) ?? { frust: false, bought: false, rage: false, dead: false, thrash: false };
    if (e.type === 'purchase') s.bought = true;
    if (e.type === 'rage_click') (s.rage = s.frust = true), (rage += 1);
    if (e.type === 'dead_click') {
      dead += 1;
      s.dead = true;
      const n = (deadCount.get(e.session_id) ?? 0) + 1;
      deadCount.set(e.session_id, n);
      // Ein einzelner Klick ins Leere ist Neugier, erst wiederholte sind Frust
      if (n >= MIN_DEAD_FOR_FRUST) s.frust = true;
    }
    if (e.type === 'scroll_thrash') (s.thrash = s.frust = true), (thrash += 1);
    sessions.set(e.session_id, s);
  }
  const all = [...sessions.values()];
  const frustrated = all.filter((s) => s.frust);
  const others = all.filter((s) => !s.frust);
  const cr = (list: typeof all) => (list.length ? list.filter((s) => s.bought).length / list.length : 0);
  const clicks = (
    db.prepare(`SELECT COUNT(*) as n FROM click_events WHERE shop_id = ? AND kind = 'click' AND ts >= datetime('now', ?)`).get(shopId, `-${days} days`) as {
      n: number;
    }
  ).n;
  return {
    days,
    clicks,
    sessions: all.length,
    frustratedSessions: frustrated.length,
    frustrationRate: all.length ? frustrated.length / all.length : 0,
    rageClicks: rage,
    deadClicks: dead,
    scrollThrash: thrash,
    rageSessions: all.filter((s) => s.rage).length,
    deadSessions: all.filter((s) => s.dead).length,
    thrashSessions: all.filter((s) => s.thrash).length,
    conversionFrustrated: cr(frustrated),
    conversionOthers: cr(others),
  };
}

/** Rangliste der Elemente (alle Seiten oder eine Seite), sortiert nach Frust. */
export function elementStats(shopId: number, days = 30, pageKey?: string, device?: string, limit = 30): ElementStat[] {
  const rows = db
    .prepare(
      `SELECT page_key as pageKey, selector, MAX(label) as label,
         SUM(kind = 'click') as clicks, SUM(kind = 'rage_click') as rage, SUM(kind = 'dead_click') as dead,
         COUNT(DISTINCT CASE WHEN kind = 'click' THEN session_id END) as sessions,
         COUNT(DISTINCT CASE WHEN kind = 'rage_click' THEN session_id END) as rageSessions,
         COUNT(DISTINCT CASE WHEN kind = 'dead_click' THEN session_id END) as deadSessions
       FROM click_events
       WHERE shop_id = ? AND ts >= datetime('now', ?) ${pageKey ? 'AND page_key = ?' : ''} ${device ? 'AND device = ?' : ''}
       GROUP BY page_key, selector
       ORDER BY (rageSessions * 3 + deadSessions) DESC, clicks DESC
       LIMIT ?`,
    )
    .all(shopId, `-${days} days`, ...(pageKey ? [pageKey] : []), ...(device ? [device] : []), limit) as ElementStat[];
  return rows;
}

export function pageStats(shopId: number, days = 30) {
  return db
    .prepare(
      `SELECT page_key as pageKey, MAX(page_type) as pageType,
         (SELECT c2.page_path FROM click_events c2 WHERE c2.shop_id = c.shop_id AND c2.page_key = c.page_key ORDER BY c2.id DESC LIMIT 1) as pagePath,
         SUM(kind = 'click') as clicks, SUM(kind = 'rage_click') as rage, SUM(kind = 'dead_click') as dead,
         COUNT(DISTINCT session_id) as sessions
       FROM click_events c WHERE shop_id = ? AND ts >= datetime('now', ?)
       GROUP BY page_key ORDER BY clicks DESC LIMIT 50`,
    )
    .all(shopId, `-${days} days`) as { pageKey: string; pageType: string | null; pagePath: string; clicks: number; rage: number; dead: number; sessions: number }[];
}

/** Klicktiefe: Anteil der Klicks je Zehntel der Seitenhoehe. */
export function clickDepth(shopId: number, pageKey: string, days = 30, device?: string) {
  const rows = db
    .prepare(
      `SELECT MIN(9, CAST(py * 10 AS INTEGER)) as bucket, COUNT(*) as n FROM click_events
       WHERE shop_id = ? AND page_key = ? AND kind = 'click' AND py IS NOT NULL AND ts >= datetime('now', ?) ${device ? 'AND device = ?' : ''}
       GROUP BY bucket ORDER BY bucket`,
    )
    .all(shopId, pageKey, `-${days} days`, ...(device ? [device] : [])) as { bucket: number; n: number }[];
  const total = rows.reduce((s, r) => s + r.n, 0);
  return Array.from({ length: 10 }, (_, i) => {
    const n = rows.find((r) => r.bucket === i)?.n ?? 0;
    return { from: i * 10, to: i * 10 + 10, clicks: n, share: total ? n / total : 0 };
  });
}

/** Punkte fuer die Heatmap-Ansicht auf der Shopseite (juengste zuerst, begrenzt). */
export function heatmapPoints(shopId: number, pageKey: string, days: number, device?: string) {
  return db
    .prepare(
      `SELECT selector as s, kind as k, ox, oy, px, py FROM click_events
       WHERE shop_id = ? AND page_key = ? AND ts >= datetime('now', ?) ${device ? 'AND device = ?' : ''}
       ORDER BY id DESC LIMIT 5000`,
    )
    .all(shopId, pageKey, `-${days} days`, ...(device ? [device] : []));
}

export function frustrationTypes() {
  return FRUST_TYPES;
}

/**
 * Wirkung eines Problem-Elements: Kaufquote der Sessions mit dem Signal an diesem Element im
 * Vergleich zu Sessions, die auf derselben Seite geklickt haben, aber ohne dieses Signal.
 */
export function elementImpact(shopId: number, days: number, pageKey: string, selector: string, kind: 'rage_click' | 'dead_click') {
  const row = db
    .prepare(
      `WITH page_sessions AS (
         SELECT session_id, MAX(selector = ? AND kind = ?) AS affected
         FROM click_events WHERE shop_id = ? AND page_key = ? AND ts >= datetime('now', ?)
         GROUP BY session_id
       ),
       buyers AS (SELECT DISTINCT session_id FROM events WHERE shop_id = ? AND type = 'purchase' AND ts >= datetime('now', ?))
       SELECT
         SUM(affected) AS affected,
         SUM(affected AND b.session_id IS NOT NULL) AS affectedBuyers,
         SUM(NOT affected) AS others,
         SUM((NOT affected) AND b.session_id IS NOT NULL) AS otherBuyers
       FROM page_sessions p LEFT JOIN buyers b ON b.session_id = p.session_id`,
    )
    .get(selector, kind, shopId, pageKey, `-${days} days`, shopId, `-${days} days`) as {
    affected: number | null;
    affectedBuyers: number | null;
    others: number | null;
    otherBuyers: number | null;
  };
  const affected = row.affected ?? 0;
  const others = row.others ?? 0;
  return {
    affectedSessions: affected,
    affectedConversion: affected ? (row.affectedBuyers ?? 0) / affected : 0,
    baselineSessions: others,
    baselineConversion: others ? (row.otherBuyers ?? 0) / others : 0,
  };
}

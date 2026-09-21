import * as cheerio from 'cheerio';

export interface ExtractedBusiness {
  name: string;
  url: string | null;
}

/**
 * Extrahiert LocalBusiness/Organization-Eintraege aus eingebettetem JSON-LD.
 * Haendler-/Filialfinder betten das haeufig fuer SEO ein (Google "Local Business"
 * Markup) - das ist die robusteste, strukturschema-unabhaengige Strategie.
 */
export function extractFromJsonLd(html: string): ExtractedBusiness[] {
  const $ = cheerio.load(html);
  const results: ExtractedBusiness[] = [];

  const relevantTypes = new Set([
    'localbusiness',
    'store',
    'organization',
    'clothingstore',
    'electronicsstore',
    'hardwarestore',
    'grocerystore',
    'homegoodsstore',
  ]);

  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const obj = node as Record<string, unknown>;
    const rawType = obj['@type'];
    const types = (Array.isArray(rawType) ? rawType : [rawType]).filter(Boolean).map((t) => String(t).toLowerCase());
    if (types.some((t) => relevantTypes.has(t))) {
      const name = typeof obj.name === 'string' ? obj.name.trim() : null;
      const url = typeof obj.url === 'string' ? obj.url.trim() : null;
      if (name) results.push({ name, url });
    }
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') visit(value);
    }
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try {
      visit(JSON.parse(raw));
    } catch {
      // ungueltiges/partielles JSON-LD - ueberspringen statt den ganzen Connector abzubrechen
    }
  });

  return results;
}

/**
 * Fallback-Strategie ueber CSS-Selektoren, falls eine Quelle kein JSON-LD liefert.
 * Die Selektoren sind pro Quelle konfigurierbar und muessen gegen die echte,
 * live erreichbare Seite verifiziert/angepasst werden (siehe README).
 */
export function extractWithSelectors(
  html: string,
  opts: { item: string; name: string; link?: string },
): ExtractedBusiness[] {
  const $ = cheerio.load(html);
  const results: ExtractedBusiness[] = [];

  $(opts.item).each((_, el) => {
    const scope = $(el);
    const name = scope.find(opts.name).first().text().trim() || scope.text().trim();
    const href = opts.link ? scope.find(opts.link).first().attr('href') : scope.attr('href');
    if (name) results.push({ name, url: href ?? null });
  });

  return results;
}

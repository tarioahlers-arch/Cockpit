// Normalisierung fuer die Dedup-Pruefung: Firmenname und Domain werden auf eine
// vergleichbare Form gebracht, bevor gegen bestehende companies-Eintraege
// abgeglichen wird (siehe Punkt 5 "DEDUPLIZIERUNG" im Auftrag).

const LEGAL_SUFFIXES = [
  'gmbh & co\\. kg',
  'gmbh & co kg',
  'gmbh',
  'mbh',
  'ag',
  'kgaa',
  'e\\.k\\.',
  'ek',
  'ohg',
  'kg',
  'ug \\(haftungsbeschraenkt\\)',
  'ug',
  'co\\.',
  'inc\\.',
  'ltd\\.',
];

const SUFFIX_PATTERN = new RegExp(`\\b(${LEGAL_SUFFIXES.join('|')})\\b\\.?`, 'gi');

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // Diakritika entfernen
    .replace(SUFFIX_PATTERN, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const url = input.includes('://') ? input : `https://${input}`;
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

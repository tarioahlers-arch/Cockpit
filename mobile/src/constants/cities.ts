// German cities supported per docs/API_CONTRACT.md.
export const GERMAN_CITIES = [
  'Berlin',
  'Hamburg',
  'München',
  'Köln',
  'Frankfurt am Main',
  'Stuttgart',
  'Düsseldorf',
  'Leipzig',
] as const;

export type GermanCity = (typeof GERMAN_CITIES)[number];

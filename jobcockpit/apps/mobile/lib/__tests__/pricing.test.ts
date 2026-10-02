import {
  annualDiscountPercent,
  canAddCv,
  canGenerateLetter,
  canTrackApplication,
  effectiveTier,
  remainingLetters,
} from '@/lib/pricing';

describe('pricing', () => {
  it('Jahresabo spart ca. 26 %', () => {
    expect(annualDiscountPercent()).toBe(26);
  });

  it('Free-Tier: 3 Anschreiben pro Monat', () => {
    expect(remainingLetters('free', 0)).toBe(3);
    expect(remainingLetters('free', 5)).toBe(0);
    expect(canGenerateLetter('free', 2)).toBe(true);
    expect(canGenerateLetter('free', 3)).toBe(false);
  });

  it('Pro-Tier: unbegrenzte Anschreiben', () => {
    expect(canGenerateLetter('pro', 10_000)).toBe(true);
    expect(canGenerateLetter('pro_annual', 10_000)).toBe(true);
  });

  it('CV-Slots: 1 im Free-, 5 im Pro-Tier', () => {
    expect(canAddCv('free', 0)).toBe(true);
    expect(canAddCv('free', 1)).toBe(false);
    expect(canAddCv('pro', 4)).toBe(true);
    expect(canAddCv('pro', 5)).toBe(false);
  });

  it('Tracker: 20 Bewerbungen im Free-Tier', () => {
    expect(canTrackApplication('free', 19)).toBe(true);
    expect(canTrackApplication('free', 20)).toBe(false);
    expect(canTrackApplication('pro', 500)).toBe(true);
  });

  it('abgelaufenes Abo fällt auf free zurück', () => {
    const now = new Date('2026-10-02T12:00:00Z');
    expect(effectiveTier('pro', '2026-10-01T00:00:00Z', now)).toBe('free');
    expect(effectiveTier('pro', '2026-11-01T00:00:00Z', now)).toBe('pro');
    expect(effectiveTier('pro_annual', null, now)).toBe('pro_annual');
    expect(effectiveTier('free', '2030-01-01T00:00:00Z', now)).toBe('free');
  });
});

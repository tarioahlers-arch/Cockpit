import type { SubscriptionTier } from '@/types/database';

/**
 * Tier-Limits laut Produkt-Spezifikation (Abschnitt 6). Die maßgebliche Prüfung
 * passiert serverseitig in der Edge Function – diese Werte dienen der UI.
 */
export interface TierLimits {
  lettersPerMonth: number; // Infinity = unbegrenzt
  cvSlots: number;
  trackedApplications: number;
  showsProPromo: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: { lettersPerMonth: 3, cvSlots: 1, trackedApplications: 20, showsProPromo: true },
  pro: {
    lettersPerMonth: Infinity,
    cvSlots: 5,
    trackedApplications: Infinity,
    showsProPromo: false,
  },
  pro_annual: {
    lettersPerMonth: Infinity,
    cvSlots: 5,
    trackedApplications: Infinity,
    showsProPromo: false,
  },
};

export const PRICES_EUR = { proMonthly: 9.99, proAnnual: 89 } as const;

/** Ersparnis des Jahresabos gegenüber 12 Monatszahlungen, gerundet in Prozent. */
export function annualDiscountPercent(
  monthly: number = PRICES_EUR.proMonthly,
  annual: number = PRICES_EUR.proAnnual,
): number {
  return Math.round((1 - annual / (monthly * 12)) * 100);
}

/** Ein abgelaufenes Abo fällt auf "free" zurück. */
export function effectiveTier(
  tier: SubscriptionTier,
  expiresAt: string | null,
  now: Date = new Date(),
): SubscriptionTier {
  if (tier === 'free') return 'free';
  if (expiresAt !== null && new Date(expiresAt).getTime() <= now.getTime()) return 'free';
  return tier;
}

export function remainingLetters(tier: SubscriptionTier, usedThisMonth: number): number {
  const limit = TIER_LIMITS[tier].lettersPerMonth;
  return Math.max(0, limit - usedThisMonth);
}

export function canGenerateLetter(tier: SubscriptionTier, usedThisMonth: number): boolean {
  return remainingLetters(tier, usedThisMonth) > 0;
}

export function canAddCv(tier: SubscriptionTier, currentCount: number): boolean {
  return currentCount < TIER_LIMITS[tier].cvSlots;
}

export function canTrackApplication(tier: SubscriptionTier, currentCount: number): boolean {
  return currentCount < TIER_LIMITS[tier].trackedApplications;
}

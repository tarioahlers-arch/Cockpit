// All prices on the wire are integer cents (EUR). These helpers convert
// to/from the euro amounts used in form inputs and format for display.

/** Formats integer cents as a German-style euro string, e.g. 6000 -> "60,00 €". */
export function formatCents(cents: number | null | undefined): string {
  const value = ((cents ?? 0) / 100).toFixed(2).replace('.', ',');
  return `${value} €`;
}

/** Parses a user-entered euro string (comma or dot decimal) into integer cents. */
export function eurosToCents(input: string): number | null {
  const normalized = input.trim().replace(/\./g, '').replace(',', '.');
  if (normalized === '') return null;
  const value = Number(normalized);
  if (Number.isNaN(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Converts integer cents to a euro string suitable for pre-filling a form input. */
export function centsToEuroInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

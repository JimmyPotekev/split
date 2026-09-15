// Tiny formatting helpers. All amounts internally are integer cents.
// Keeps the UI code from having to remember the conversion.

export function centsToDisplay(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

// User types "12.34" -> 1234. Tolerates "$12.34", "12", "12.3".
// Returns null on garbage so callers can validate.
export function parseAmountToCents(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

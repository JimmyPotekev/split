// Currency helpers. Internally every amount is an integer in the currency's
// smallest unit ("minor unit"): cents for USD, yen for JPY, fils for KWD, etc.
// This matters because different currencies have different decimals, and
// hard-coding "cents = value * 100" gives you 1/100th-yen ghosts that never
// display but do drift balances.

// ISO 4217 currencies we care about right now, grouped by minor-unit exponent.
// Anything not listed falls through to 100, which is right for the vast
// majority of currencies.
const ZERO_DECIMAL = new Set([
  'JPY', 'KRW', 'VND', 'CLP', 'ISK', 'HUF', 'TWD', 'RWF', 'UGX', 'XAF', 'XOF',
])
const THREE_DECIMAL = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND'])

export function minorUnitFactor(currency: string): number {
  const c = currency.toUpperCase()
  if (ZERO_DECIMAL.has(c)) return 1
  if (THREE_DECIMAL.has(c)) return 1000
  return 100
}

export function minorToDisplay(minor: number, currency: string): string {
  const factor = minorUnitFactor(currency)
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(minor / factor)
}

// User types "12.34" -> 1234 for USD, or "10000" -> 10000 for JPY.
// Tolerates leading $, commas, spaces. Returns null on garbage.
export function parseAmountToMinor(raw: string, currency: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return Math.round(n * minorUnitFactor(currency))
}

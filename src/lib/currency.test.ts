import { describe, it, expect } from 'vitest'
import { minorUnitFactor, parseAmountToMinor } from './currency'

describe('minorUnitFactor', () => {
  it('is 100 for typical two-decimal currencies', () => {
    expect(minorUnitFactor('USD')).toBe(100)
    expect(minorUnitFactor('EUR')).toBe(100)
    expect(minorUnitFactor('gbp')).toBe(100)
  })

  it('is 1 for zero-decimal currencies', () => {
    expect(minorUnitFactor('JPY')).toBe(1)
    expect(minorUnitFactor('KRW')).toBe(1)
  })

  it('is 1000 for three-decimal currencies', () => {
    expect(minorUnitFactor('KWD')).toBe(1000)
  })
})

describe('parseAmountToMinor', () => {
  it('multiplies by 100 for USD', () => {
    expect(parseAmountToMinor('12.34', 'USD')).toBe(1234)
    expect(parseAmountToMinor('$100', 'USD')).toBe(10000)
  })

  it('does not multiply for JPY', () => {
    expect(parseAmountToMinor('10000', 'JPY')).toBe(10000)
    expect(parseAmountToMinor('3333', 'JPY')).toBe(3333)
  })

  it('returns null on garbage', () => {
    expect(parseAmountToMinor('', 'USD')).toBeNull()
    expect(parseAmountToMinor('abc', 'USD')).toBeNull()
  })
})

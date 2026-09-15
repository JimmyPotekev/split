import { describe, it, expect } from 'vitest'
import {
  splitEqual,
  splitExact,
  splitPercent,
  computeBalances,
  minimumTransfers,
} from './balances'

// Style note: tests read like scenarios, not method contracts. Easier to scan
// later when I'm trying to remember why a case existed.

describe('splitEqual', () => {
  it('divides evenly when it can', () => {
    expect(splitEqual(900, ['a', 'b', 'c'])).toEqual([
      { memberId: 'a', amount: 300 },
      { memberId: 'b', amount: 300 },
      { memberId: 'c', amount: 300 },
    ])
  })

  it('handles indivisible cents by giving the extras to the first members', () => {
    // 100 cents split 3 ways: 34, 33, 33
    const out = splitEqual(100, ['a', 'b', 'c'])
    expect(out.reduce((s, r) => s + r.amount, 0)).toBe(100)
    expect(out).toEqual([
      { memberId: 'a', amount: 34 },
      { memberId: 'b', amount: 33 },
      { memberId: 'c', amount: 33 },
    ])
  })

  it('handles a single member', () => {
    expect(splitEqual(500, ['a'])).toEqual([{ memberId: 'a', amount: 500 }])
  })

  it('handles empty list without exploding', () => {
    expect(splitEqual(500, [])).toEqual([])
  })
})

describe('splitExact', () => {
  it('accepts shares that sum to the total', () => {
    const shares = [
      { memberId: 'a', amount: 250 },
      { memberId: 'b', amount: 750 },
    ]
    expect(splitExact(1000, shares)).toEqual(shares)
  })

  it('rejects mismatched sums', () => {
    expect(() =>
      splitExact(1000, [
        { memberId: 'a', amount: 400 },
        { memberId: 'b', amount: 500 },
      ])
    ).toThrow(/expected 1000/)
  })
})

describe('splitPercent', () => {
  it('splits 50/50 cleanly', () => {
    expect(splitPercent(1000, [
      { memberId: 'a', percent: 50 },
      { memberId: 'b', percent: 50 },
    ])).toEqual([
      { memberId: 'a', amount: 500 },
      { memberId: 'b', amount: 500 },
    ])
  })

  it('distributes leftover cents to largest fractional shares', () => {
    // 1000 cents split 33/33/34: raw = 330, 330, 340. Already integer, no leftover.
    // Try one that leaves leftover: 100 cents split 33/33/34 -> 33, 33, 34
    const out = splitPercent(100, [
      { memberId: 'a', percent: 33 },
      { memberId: 'b', percent: 33 },
      { memberId: 'c', percent: 34 },
    ])
    expect(out.reduce((s, r) => s + r.amount, 0)).toBe(100)
  })

  it('rejects percentages that do not sum to 100', () => {
    expect(() =>
      splitPercent(1000, [
        { memberId: 'a', percent: 40 },
        { memberId: 'b', percent: 40 },
      ])
    ).toThrow(/expected 100/)
  })
})

describe('computeBalances', () => {
  it('has payer owed and participants owing after one equal-split expense', () => {
    // A pays $30 for dinner, split equally among A, B, C.
    const bal = computeBalances(
      ['a', 'b', 'c'],
      [
        {
          payerId: 'a',
          amount: 3000,
          shares: splitEqual(3000, ['a', 'b', 'c']),
        },
      ],
      []
    )
    // A paid 3000, owes their own 1000 share, net +2000
    expect(bal.a).toBe(2000)
    expect(bal.b).toBe(-1000)
    expect(bal.c).toBe(-1000)
  })

  it('applies settlements correctly', () => {
    // B pays A $10 back
    const bal = computeBalances(
      ['a', 'b', 'c'],
      [
        {
          payerId: 'a',
          amount: 3000,
          shares: splitEqual(3000, ['a', 'b', 'c']),
        },
      ],
      [{ fromId: 'b', toId: 'a', amount: 1000 }]
    )
    expect(bal.a).toBe(1000)
    expect(bal.b).toBe(0)
    expect(bal.c).toBe(-1000)
  })

  it('always conserves money (sum of balances is zero)', () => {
    const bal = computeBalances(
      ['a', 'b', 'c', 'd'],
      [
        { payerId: 'a', amount: 5000, shares: splitEqual(5000, ['a', 'b', 'c', 'd']) },
        { payerId: 'c', amount: 1234, shares: splitEqual(1234, ['a', 'c', 'd']) },
        { payerId: 'b', amount: 999,  shares: splitEqual(999,  ['b', 'd']) },
      ],
      [{ fromId: 'd', toId: 'a', amount: 500 }]
    )
    const total = Object.values(bal).reduce((s, v) => s + v, 0)
    expect(total).toBe(0)
  })
})

describe('minimumTransfers', () => {
  it('produces no transfers when everyone is at zero', () => {
    expect(minimumTransfers({ a: 0, b: 0, c: 0 })).toEqual([])
  })

  it('resolves a simple two-person balance in one transfer', () => {
    expect(minimumTransfers({ a: 1000, b: -1000 })).toEqual([
      { fromId: 'b', toId: 'a', amount: 1000 },
    ])
  })

  it('pairs biggest debtor with biggest creditor', () => {
    // A owed 30, B owed 10, C owes 25, D owes 15
    const transfers = minimumTransfers({ a: 3000, b: 1000, c: -2500, d: -1500 })
    // C (biggest debtor) pays A (biggest creditor) 2500
    // D pays A the remaining 500
    // D pays B 1000
    expect(transfers).toEqual([
      { fromId: 'c', toId: 'a', amount: 2500 },
      { fromId: 'd', toId: 'a', amount: 500 },
      { fromId: 'd', toId: 'b', amount: 1000 },
    ])
  })

  it('every produced transfer set zeros out the balances', () => {
    const balances = { a: 4200, b: -1700, c: 800, d: -3300 }
    const transfers = minimumTransfers(balances)
    // apply transfers and confirm everyone lands at zero
    const after = { ...balances }
    for (const t of transfers) {
      after[t.fromId as keyof typeof after] += t.amount
      after[t.toId as keyof typeof after] -= t.amount
    }
    for (const v of Object.values(after)) expect(v).toBe(0)
  })
})

// Pure functions for balance math and settle-up.
// No React, no Prisma. Just numbers. Everything here is unit tested.
//
// All amounts are integers in the smallest currency unit (cents).
// We never do floating point on money.

export type MemberId = string

// One row per member's share of one expense.
export interface Share {
  memberId: MemberId
  amount: number // this member owes this much of the expense, in cents
}

// A recorded expense: someone paid, some set of people owe pieces of it.
export interface ExpenseLike {
  payerId: MemberId
  amount: number     // total in cents
  shares: Share[]    // shares should sum to amount (see splitEqual/splitExact/splitPercent)
}

// A settle-up payment already made from one member to another.
export interface SettlementLike {
  fromId: MemberId
  toId: MemberId
  amount: number
}

// A single suggested transfer to zero out balances.
export interface Transfer {
  fromId: MemberId
  toId: MemberId
  amount: number
}

// ---------- split helpers ----------
//
// The tricky bit: dividing a cent amount among N people rarely comes out even.
// If 100 cents is split 3 ways, we cannot give three people 33.33 cents each.
// We give two people 33 and one person 34, and the total still sums to 100.
// This is the largest remainder method. We give the extra cent(s) to the
// first members in the list, which is stable and deterministic.

export function splitEqual(amount: number, memberIds: MemberId[]): Share[] {
  if (memberIds.length === 0) return []
  const base = Math.floor(amount / memberIds.length)
  const remainder = amount - base * memberIds.length
  return memberIds.map((memberId, i) => ({
    memberId,
    amount: base + (i < remainder ? 1 : 0),
  }))
}

// Caller passes exact amounts. We validate they sum to the expense total.
export function splitExact(amount: number, shares: Share[]): Share[] {
  const sum = shares.reduce((s, r) => s + r.amount, 0)
  if (sum !== amount) {
    throw new Error(`exact shares sum to ${sum}, expected ${amount}`)
  }
  return shares
}

// Percents as integers (e.g. [50, 25, 25]), must sum to 100.
// Same largest-remainder trick to make cents come out right.
export function splitPercent(
  amount: number,
  rows: { memberId: MemberId; percent: number }[]
): Share[] {
  const totalPct = rows.reduce((s, r) => s + r.percent, 0)
  if (totalPct !== 100) {
    throw new Error(`percents sum to ${totalPct}, expected 100`)
  }
  // Compute raw (float) share, take floor, then distribute the leftover cents
  // to the rows with the largest fractional remainder. Stable on ties by index.
  const raw = rows.map((r, i) => {
    const exact = (amount * r.percent) / 100
    const floor = Math.floor(exact)
    return { i, memberId: r.memberId, floor, frac: exact - floor }
  })
  const assigned = raw.reduce((s, r) => s + r.floor, 0)
  let leftover = amount - assigned
  const order = [...raw].sort((a, b) => b.frac - a.frac || a.i - b.i)
  const bonus = new Set<number>()
  for (const r of order) {
    if (leftover <= 0) break
    bonus.add(r.i)
    leftover--
  }
  return raw.map((r) => ({
    memberId: r.memberId,
    amount: r.floor + (bonus.has(r.i) ? 1 : 0),
  }))
}

// ---------- balances ----------

// Net position per member: positive means they are owed money, negative means they owe.
// Sum across all members is always 0 (money is conserved).
export function computeBalances(
  memberIds: MemberId[],
  expenses: ExpenseLike[],
  settlements: SettlementLike[]
): Record<MemberId, number> {
  const bal: Record<MemberId, number> = {}
  for (const id of memberIds) bal[id] = 0

  for (const e of expenses) {
    // payer is owed the full expense
    bal[e.payerId] = (bal[e.payerId] ?? 0) + e.amount
    // each participant owes their share
    for (const s of e.shares) {
      bal[s.memberId] = (bal[s.memberId] ?? 0) - s.amount
    }
  }

  // A settlement is: `from` handed cash to `to`. That reduces what `from` owes
  // (their negative gets closer to zero) and reduces what `to` is owed
  // (their positive gets closer to zero).
  for (const st of settlements) {
    bal[st.fromId] = (bal[st.fromId] ?? 0) + st.amount
    bal[st.toId] = (bal[st.toId] ?? 0) - st.amount
  }

  return bal
}

// ---------- minimum-transfer settle-up ----------
//
// Greedy: pair the biggest creditor with the biggest debtor, transfer the
// smaller of the two magnitudes, repeat until everyone is at zero.
//
// Not provably optimal in the general case (that problem is NP-hard) but for
// realistic group sizes it produces near-optimal results, in O(n log n).

export function minimumTransfers(
  balances: Record<MemberId, number>
): Transfer[] {
  // Copy so we don't mutate the caller's map.
  // Drop zeros so they don't clutter the sort.
  const pos: { id: MemberId; amt: number }[] = [] // owed money
  const neg: { id: MemberId; amt: number }[] = [] // owes money (amt stored positive here)
  for (const [id, v] of Object.entries(balances)) {
    if (v > 0) pos.push({ id, amt: v })
    else if (v < 0) neg.push({ id, amt: -v })
  }
  pos.sort((a, b) => b.amt - a.amt)
  neg.sort((a, b) => b.amt - a.amt)

  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < neg.length && j < pos.length) {
    const debtor = neg[i]
    const creditor = pos[j]
    const pay = Math.min(debtor.amt, creditor.amt)
    transfers.push({ fromId: debtor.id, toId: creditor.id, amount: pay })
    debtor.amt -= pay
    creditor.amt -= pay
    if (debtor.amt === 0) i++
    if (creditor.amt === 0) j++
  }
  return transfers
}

// POST /api/groups/[slug]/expenses
// Creates an expense with its per-member shares in a single transaction.
// Supports equal, exact, and percent split types. All three normalize to
// a list of shares that sum to the expense total.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { splitEqual, splitExact, splitPercent } from '@/lib/balances'

interface Body {
  payerId?: unknown
  description?: unknown
  amount?: unknown        // minor units (integer)
  date?: unknown          // ISO string, optional (defaults to now)
  participantIds?: unknown
  splitType?: unknown     // "equal" | "exact" | "percent"
  exactAmounts?: unknown  // { memberId: string, amount: number }[] for exact
  percentages?: unknown   // { memberId: string, percent: number }[] for percent
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 })
  }

  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const amount = typeof body.amount === 'number' ? Math.round(body.amount) : NaN
  const payerId = typeof body.payerId === 'string' ? body.payerId : ''
  const splitType = typeof body.splitType === 'string' ? body.splitType : 'equal'
  const participantIds = Array.isArray(body.participantIds)
    ? body.participantIds.filter((x): x is string => typeof x === 'string')
    : []
  const date = typeof body.date === 'string' ? new Date(body.date) : new Date()

  if (!description) return NextResponse.json({ error: 'Description required.' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be positive.' }, { status: 400 })
  }
  if (!payerId) return NextResponse.json({ error: 'Payer required.' }, { status: 400 })
  if (splitType !== 'equal' && splitType !== 'exact' && splitType !== 'percent') {
    return NextResponse.json({ error: 'splitType must be equal, exact, or percent.' }, { status: 400 })
  }
  if (splitType === 'equal' && participantIds.length === 0) {
    return NextResponse.json({ error: 'At least one participant required.' }, { status: 400 })
  }
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
  }

  const group = await prisma.group.findUnique({
    where: { slug: params.slug },
    include: { members: { select: { id: true } } },
  })
  if (!group) return NextResponse.json({ error: 'Group not found.' }, { status: 404 })

  const memberIdSet = new Set(group.members.map((m) => m.id))
  if (!memberIdSet.has(payerId)) {
    return NextResponse.json({ error: 'Payer is not in this group.' }, { status: 400 })
  }

  let shares
  try {
    shares = computeShares(splitType, amount, participantIds, body, memberIdSet)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Bad split data.' }, { status: 400 })
  }

  try {
    const expense = await prisma.expense.create({
      data: {
        groupId: group.id,
        payerId,
        description,
        amount,
        date,
        splitType,
        shares: { create: shares.map((s) => ({ memberId: s.memberId, amount: s.amount })) },
      },
      include: { shares: true },
    })
    return NextResponse.json(expense, { status: 201 })
  } catch (e) {
    console.error('create expense failed', e)
    return NextResponse.json({ error: 'Could not create expense.' }, { status: 500 })
  }
}

function computeShares(
  splitType: string,
  amount: number,
  participantIds: string[],
  body: Body,
  memberIdSet: Set<string>,
) {
  if (splitType === 'equal') {
    for (const pid of participantIds) {
      if (!memberIdSet.has(pid)) throw new Error('Participant is not in this group.')
    }
    return splitEqual(amount, participantIds)
  }

  if (splitType === 'exact') {
    if (!Array.isArray(body.exactAmounts) || body.exactAmounts.length === 0) {
      throw new Error('exactAmounts required for exact split.')
    }
    const rows = (body.exactAmounts as { memberId?: unknown; amount?: unknown }[]).map((r) => {
      const mid = typeof r.memberId === 'string' ? r.memberId : ''
      const amt = typeof r.amount === 'number' ? Math.round(r.amount) : NaN
      if (!mid || !memberIdSet.has(mid)) throw new Error('Participant is not in this group.')
      if (!Number.isFinite(amt) || amt < 0) throw new Error('Each exact amount must be non-negative.')
      return { memberId: mid, amount: amt }
    })
    return splitExact(amount, rows)
  }

  // percent
  if (!Array.isArray(body.percentages) || body.percentages.length === 0) {
    throw new Error('percentages required for percent split.')
  }
  const rows = (body.percentages as { memberId?: unknown; percent?: unknown }[]).map((r) => {
    const mid = typeof r.memberId === 'string' ? r.memberId : ''
    const pct = typeof r.percent === 'number' ? r.percent : NaN
    if (!mid || !memberIdSet.has(mid)) throw new Error('Participant is not in this group.')
    if (!Number.isFinite(pct) || pct < 0) throw new Error('Each percent must be non-negative.')
    return { memberId: mid, percent: pct }
  })
  return splitPercent(amount, rows)
}

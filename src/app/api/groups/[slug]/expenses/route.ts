// POST /api/groups/[slug]/expenses
// Creates an expense with its per-member shares in a single transaction.
// Currently supports "equal" split; "exact" and "percent" will be added later
// but the schema already stores them uniformly as a list of shares that sum
// to the total, so those additions won't touch the shape here.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { splitEqual } from '@/lib/balances'

interface Body {
  payerId?: unknown
  description?: unknown
  amount?: unknown        // cents (integer)
  date?: unknown          // ISO string, optional (defaults to now)
  participantIds?: unknown
  splitType?: unknown     // "equal" for now
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
  if (participantIds.length === 0) {
    return NextResponse.json({ error: 'At least one participant required.' }, { status: 400 })
  }
  if (splitType !== 'equal') {
    return NextResponse.json({ error: 'Only equal split supported for now.' }, { status: 400 })
  }
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
  }

  // Look up the group and confirm all referenced members belong to it.
  // This is our access control: if you know a memberId that isn't in this
  // group, the request fails. No cross-group data leaks.
  const group = await prisma.group.findUnique({
    where: { slug: params.slug },
    include: { members: { select: { id: true } } },
  })
  if (!group) return NextResponse.json({ error: 'Group not found.' }, { status: 404 })

  const memberIdSet = new Set(group.members.map((m) => m.id))
  if (!memberIdSet.has(payerId)) {
    return NextResponse.json({ error: 'Payer is not in this group.' }, { status: 400 })
  }
  for (const pid of participantIds) {
    if (!memberIdSet.has(pid)) {
      return NextResponse.json({ error: 'Participant is not in this group.' }, { status: 400 })
    }
  }

  const shares = splitEqual(amount, participantIds)

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

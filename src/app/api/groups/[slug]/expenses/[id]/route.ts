// DELETE + PATCH /api/groups/[slug]/expenses/[id]
// DELETE removes an expense (shares cascade via schema).
// PATCH updates description, amount, payer, date, participants, splitType.
// When amount, participants, or splitType change we nuke old shares and recompute.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { splitEqual, splitExact, splitPercent } from '@/lib/balances'

export async function DELETE(
  _req: Request,
  { params }: { params: { slug: string; id: string } }
) {
  const expense = await prisma.expense.findUnique({
    where: { id: params.id },
    select: { id: true, group: { select: { slug: true } } },
  })
  if (!expense || expense.group.slug !== params.slug) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  await prisma.expense.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

interface PatchBody {
  description?: unknown
  amount?: unknown
  payerId?: unknown
  date?: unknown
  participantIds?: unknown
  splitType?: unknown
  exactAmounts?: unknown
  percentages?: unknown
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  const expense = await prisma.expense.findUnique({
    where: { id: params.id },
    include: { group: { include: { members: { select: { id: true } } } }, shares: true },
  })
  if (!expense || expense.group.slug !== params.slug) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 })
  }

  const description = typeof body.description === 'string' ? body.description.trim() : expense.description
  const amount = typeof body.amount === 'number' ? Math.round(body.amount) : expense.amount
  const payerId = typeof body.payerId === 'string' ? body.payerId : expense.payerId
  const splitType = typeof body.splitType === 'string' ? body.splitType : expense.splitType
  const date = typeof body.date === 'string' ? new Date(body.date) : expense.date

  if (!description) return NextResponse.json({ error: 'Description required.' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be positive.' }, { status: 400 })
  }
  if (splitType !== 'equal' && splitType !== 'exact' && splitType !== 'percent') {
    return NextResponse.json({ error: 'splitType must be equal, exact, or percent.' }, { status: 400 })
  }
  if (date instanceof Date && isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
  }

  const memberIdSet = new Set(expense.group.members.map((m) => m.id))
  if (!memberIdSet.has(payerId)) {
    return NextResponse.json({ error: 'Payer is not in this group.' }, { status: 400 })
  }

  const oldParticipantIds = expense.shares.map((s) => s.memberId).sort()
  const participantIds = Array.isArray(body.participantIds)
    ? body.participantIds.filter((x): x is string => typeof x === 'string')
    : null
  const newParticipantIds = participantIds ? [...participantIds].sort() : oldParticipantIds

  if (newParticipantIds.length === 0) {
    return NextResponse.json({ error: 'At least one participant required.' }, { status: 400 })
  }
  for (const pid of newParticipantIds) {
    if (!memberIdSet.has(pid)) {
      return NextResponse.json({ error: 'Participant is not in this group.' }, { status: 400 })
    }
  }

  const sharesChanged =
    participantIds !== null ||
    amount !== expense.amount ||
    splitType !== expense.splitType ||
    body.exactAmounts !== undefined ||
    body.percentages !== undefined

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (sharesChanged) {
        await tx.expenseShare.deleteMany({ where: { expenseId: params.id } })

        let shares
        if (splitType === 'equal') {
          shares = splitEqual(amount, newParticipantIds)
        } else if (splitType === 'exact') {
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
          shares = splitExact(amount, rows)
        } else {
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
          shares = splitPercent(amount, rows)
        }

        await tx.expenseShare.createMany({
          data: shares.map((s) => ({
            expenseId: params.id,
            memberId: s.memberId,
            amount: s.amount,
          })),
        })
      }

      return tx.expense.update({
        where: { id: params.id },
        data: { description, amount, payerId, date, splitType },
        include: { shares: true },
      })
    })
    return NextResponse.json(updated)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not update expense.'
    console.error('update expense failed', e)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

// DELETE + PATCH /api/groups/[slug]/expenses/[id]
// DELETE removes an expense (shares cascade via schema).
// PATCH updates description, amount, payer, date, participants, splitType.
// When amount or participants change we nuke old shares and recompute.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { splitEqual } from '@/lib/balances'

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
  const participantIds = Array.isArray(body.participantIds)
    ? body.participantIds.filter((x): x is string => typeof x === 'string')
    : null

  if (!description) return NextResponse.json({ error: 'Description required.' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be positive.' }, { status: 400 })
  }
  if (splitType !== 'equal') {
    return NextResponse.json({ error: 'Only equal split supported for now.' }, { status: 400 })
  }
  if (date instanceof Date && isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
  }

  const memberIdSet = new Set(expense.group.members.map((m) => m.id))
  if (!memberIdSet.has(payerId)) {
    return NextResponse.json({ error: 'Payer is not in this group.' }, { status: 400 })
  }

  // figure out if shares need rebuilding
  const oldParticipantIds = expense.shares.map((s) => s.memberId).sort()
  const newParticipantIds = participantIds
    ? [...participantIds].sort()
    : oldParticipantIds

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
    amount !== expense.amount

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (sharesChanged) {
        await tx.expenseShare.deleteMany({ where: { expenseId: params.id } })
        const shares = splitEqual(amount, newParticipantIds)
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
    console.error('update expense failed', e)
    return NextResponse.json({ error: 'Could not update expense.' }, { status: 500 })
  }
}

// POST /api/groups/[slug]/settlements
// Records a payment from one member to another. Same shape as an expense from
// the balance-math perspective, but modeled separately so we can show a
// distinct "settlement" line in the history and never confuse it with a real
// shared expense.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface Body {
  fromId?: unknown
  toId?: unknown
  amount?: unknown   // cents (integer)
  note?: unknown
  date?: unknown
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

  const fromId = typeof body.fromId === 'string' ? body.fromId : ''
  const toId = typeof body.toId === 'string' ? body.toId : ''
  const amount = typeof body.amount === 'number' ? Math.round(body.amount) : NaN
  const note = typeof body.note === 'string' ? body.note.trim() : null
  const date = typeof body.date === 'string' ? new Date(body.date) : new Date()

  if (!fromId || !toId) {
    return NextResponse.json({ error: 'From and to are required.' }, { status: 400 })
  }
  if (fromId === toId) {
    return NextResponse.json({ error: "You can't settle with yourself." }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be positive.' }, { status: 400 })
  }
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
  }

  // Same access-control pattern as expenses: both members must be in this group.
  const group = await prisma.group.findUnique({
    where: { slug: params.slug },
    include: { members: { select: { id: true } } },
  })
  if (!group) return NextResponse.json({ error: 'Group not found.' }, { status: 404 })

  const ids = new Set(group.members.map((m) => m.id))
  if (!ids.has(fromId) || !ids.has(toId)) {
    return NextResponse.json({ error: 'Member not in this group.' }, { status: 400 })
  }

  try {
    const s = await prisma.settlement.create({
      data: { groupId: group.id, fromId, toId, amount, note: note || null, date },
    })
    return NextResponse.json(s, { status: 201 })
  } catch (e) {
    console.error('create settlement failed', e)
    return NextResponse.json({ error: 'Could not record settlement.' }, { status: 500 })
  }
}

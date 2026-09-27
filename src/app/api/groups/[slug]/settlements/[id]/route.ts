// DELETE + PATCH /api/groups/[slug]/settlements/[id]

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: Request,
  { params }: { params: { slug: string; id: string } }
) {
  const s = await prisma.settlement.findUnique({
    where: { id: params.id },
    select: { id: true, group: { select: { slug: true } } },
  })
  if (!s || s.group.slug !== params.slug) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  await prisma.settlement.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

interface PatchBody {
  fromId?: unknown
  toId?: unknown
  amount?: unknown
  note?: unknown
  date?: unknown
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  const settlement = await prisma.settlement.findUnique({
    where: { id: params.id },
    include: { group: { include: { members: { select: { id: true } } } } },
  })
  if (!settlement || settlement.group.slug !== params.slug) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 })
  }

  const fromId = typeof body.fromId === 'string' ? body.fromId : settlement.fromId
  const toId = typeof body.toId === 'string' ? body.toId : settlement.toId
  const amount = typeof body.amount === 'number' ? Math.round(body.amount) : settlement.amount
  const note = body.note === null ? null : typeof body.note === 'string' ? body.note.trim() || null : settlement.note
  const date = typeof body.date === 'string' ? new Date(body.date) : settlement.date

  if (!fromId || !toId) {
    return NextResponse.json({ error: 'From and to are required.' }, { status: 400 })
  }
  if (fromId === toId) {
    return NextResponse.json({ error: "You can't settle with yourself." }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be positive.' }, { status: 400 })
  }
  if (date instanceof Date && isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
  }

  const memberIdSet = new Set(settlement.group.members.map((m) => m.id))
  if (!memberIdSet.has(fromId) || !memberIdSet.has(toId)) {
    return NextResponse.json({ error: 'Member not in this group.' }, { status: 400 })
  }

  try {
    const updated = await prisma.settlement.update({
      where: { id: params.id },
      data: { fromId, toId, amount, note, date },
    })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('update settlement failed', e)
    return NextResponse.json({ error: 'Could not update settlement.' }, { status: 500 })
  }
}

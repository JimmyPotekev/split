// DELETE + PATCH /api/groups/[slug]/members/[id]
// DELETE blocks if the member has any expenses or settlements attached.
// PATCH renames the member.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: Request,
  { params }: { params: { slug: string; id: string } }
) {
  const member = await prisma.member.findUnique({
    where: { id: params.id },
    include: {
      group: { select: { slug: true } },
      paidExpenses: { select: { id: true }, take: 1 },
      expenseShares: { select: { id: true }, take: 1 },
      settlementsFrom: { select: { id: true }, take: 1 },
      settlementsTo: { select: { id: true }, take: 1 },
    },
  })

  if (!member || member.group.slug !== params.slug) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const hasActivity =
    member.paidExpenses.length > 0 ||
    member.expenseShares.length > 0 ||
    member.settlementsFrom.length > 0 ||
    member.settlementsTo.length > 0

  if (hasActivity) {
    return NextResponse.json(
      { error: 'This member has expenses or settlements. Remove those first.' },
      { status: 409 }
    )
  }

  await prisma.member.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  const member = await prisma.member.findUnique({
    where: { id: params.id },
    include: { group: { select: { slug: true } } },
  })
  if (!member || member.group.slug !== params.slug) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  let body: { name?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })

  const updated = await prisma.member.update({
    where: { id: params.id },
    data: { name },
  })

  return NextResponse.json(updated)
}

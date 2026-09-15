// DELETE /api/groups/[slug]/settlements/[id]
// Removes a settlement. Same access pattern as expense delete.

import { NextResponse } from 'next/server'
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

// DELETE /api/groups/[slug]/expenses/[id]
// Removes an expense. Its shares cascade via the Prisma schema (onDelete:
// Cascade on Expense -> ExpenseShare). We still verify the expense belongs to
// this group so someone with one group's slug can't reach into another.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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

// GET /api/groups/[slug]
// Returns the whole group state: members, expenses (with shares), settlements.
// One query, everything the group page needs to render. As the group grows we
// can paginate expenses, but for MVP a group is a trip with maybe 50 items.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const group = await prisma.group.findUnique({
    where: { slug: params.slug },
    include: {
      members: { orderBy: { createdAt: 'asc' } },
      expenses: {
        include: { shares: true },
        orderBy: { date: 'desc' },
      },
      settlements: { orderBy: { date: 'desc' } },
    },
  })

  if (!group) return NextResponse.json({ error: 'Group not found.' }, { status: 404 })
  return NextResponse.json(group)
}

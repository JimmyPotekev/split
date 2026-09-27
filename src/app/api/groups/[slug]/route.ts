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

// PATCH /api/groups/[slug]
// Update group name and/or currency. Currency change is blocked once any
// expense or settlement exists, because stored minor-unit amounts don't
// convert across currencies.

export async function PATCH(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const group = await prisma.group.findUnique({
    where: { slug: params.slug },
    include: {
      _count: { select: { expenses: true, settlements: true } },
    },
  })

  if (!group) return NextResponse.json({ error: 'Group not found.' }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 })
  }

  const data: { name?: string; currency?: string } = {}

  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Group name cannot be empty.' }, { status: 400 })
    data.name = name
  }

  if ('currency' in body) {
    const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : ''
    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ error: 'Currency must be a 3-letter code.' }, { status: 400 })
    }
    if (currency !== group.currency && (group._count.expenses > 0 || group._count.settlements > 0)) {
      return NextResponse.json(
        { error: 'Currency cannot be changed after expenses or settlements have been recorded.' },
        { status: 409 }
      )
    }
    data.currency = currency
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const updated = await prisma.group.update({
    where: { slug: params.slug },
    data,
  })

  return NextResponse.json(updated)
}

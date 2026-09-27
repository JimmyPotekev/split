// POST /api/groups/[slug]/members
// Add a new member to the group. Just a name, nothing else needed.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const group = await prisma.group.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  })
  if (!group) return NextResponse.json({ error: 'Group not found.' }, { status: 404 })

  let body: { name?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })

  const member = await prisma.member.create({
    data: { groupId: group.id, name },
  })

  return NextResponse.json(member, { status: 201 })
}

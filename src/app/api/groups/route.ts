// POST /api/groups
// Create a new group with its initial members. Returns the slug so the client
// can redirect to /g/[slug].

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { newSlug } from '@/lib/slug'

interface Body {
  name?: unknown
  currency?: unknown
  members?: unknown
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 })
  }

  // basic shape checks. not using zod yet, don't need the dep for this size.
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : 'USD'
  const rawMembers = Array.isArray(body.members) ? body.members : []
  const memberNames = rawMembers
    .filter((m): m is string => typeof m === 'string')
    .map((m) => m.trim())
    .filter(Boolean)

  if (!name) return NextResponse.json({ error: 'Group name is required.' }, { status: 400 })
  if (memberNames.length < 2) {
    return NextResponse.json({ error: 'At least two people are required.' }, { status: 400 })
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ error: 'Currency must be a 3-letter code.' }, { status: 400 })
  }

  // extremely unlikely slug collision but retry once just in case
  let slug = newSlug()
  let group
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      group = await prisma.group.create({
        data: {
          slug,
          name,
          currency,
          members: { create: memberNames.map((n) => ({ name: n })) },
        },
        select: { slug: true },
      })
      break
    } catch (e: unknown) {
      // Prisma throws P2002 for unique constraint violations
      const code = (e as { code?: string })?.code
      if (code === 'P2002') {
        slug = newSlug()
        continue
      }
      console.error('create group failed', e)
      return NextResponse.json({ error: 'Could not create group.' }, { status: 500 })
    }
  }

  if (!group) return NextResponse.json({ error: 'Could not create group.' }, { status: 500 })
  return NextResponse.json({ slug: group.slug }, { status: 201 })
}

// Group page. Server component fetches the group via Prisma directly (skips
// the API round trip since we're on the server anyway), passes it down to a
// client component for the interactive bits.

import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import GroupView from './GroupView'

export default async function GroupPage({ params }: { params: { slug: string } }) {
  const group = await prisma.group.findUnique({
    where: { slug: params.slug },
    include: {
      members: { orderBy: { createdAt: 'asc' } },
      expenses: { include: { shares: true }, orderBy: { date: 'desc' } },
      settlements: { orderBy: { date: 'desc' } },
    },
  })

  if (!group) notFound()

  // Prisma returns Date objects and BigInts fine, but the client component
  // gets serialized props. Dates serialize to strings across that boundary
  // automatically. amounts are Int not BigInt so we're safe on that front.
  return <GroupView group={group} />
}

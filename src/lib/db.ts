// Prisma client singleton.
// In dev, Next hot-reloads and would otherwise spin up a new client on every
// change, exhausting Neon's connection pool. Stashing it on globalThis avoids
// that. In prod this file is imported once per serverless invocation, fine.

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

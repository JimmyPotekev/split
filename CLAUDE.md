# CLAUDE.md

Guidance for Claude Code when editing this repo. Read this before making changes.

## Project purpose

Split is a group expense tracker aimed at travel groups (primary use case) and other small-group shared-cost scenarios. Users log expenses paid on behalf of the group, the app tracks who owes whom, and produces a minimum-transfer settle-up. Canadian users are the initial focus but nothing is hardcoded to a country.

**Product state and roadmap live in `docs/handoff.md`.** Read it before making non-trivial changes. Everything below in this file is either (a) a durable invariant that should not be broken without a deliberate decision, or (b) a mechanical rule about the codebase.

## Stack

Next.js 14 (App Router) + TypeScript, Prisma + Neon Postgres, Tailwind CSS, Vitest.

## Commands

```bash
npm run dev            # Next dev server on :3000
npm run build          # prisma generate + next build
npm start              # serve the build
npm test               # vitest run (headless)
npm run test:watch     # vitest watch
npm run db:push        # push prisma schema to Neon (dev)
npm run db:studio      # open Prisma Studio
npx prisma generate    # regenerate client after schema.prisma changes
```

Prisma CLI reads `.env`, not `.env.local`. Both files exist and hold the same values. Don't remove `.env`.

## Environment

- `DATABASE_URL` — Neon pooled connection (has `-pooler` in hostname)
- `DIRECT_URL` — Neon direct connection (no `-pooler`), used by Prisma migrations

Both are set locally in `.env` / `.env.local` and in Vercel project settings.

## Style

- **No em dashes ever.** Broadly avoid hyphens too where reasonable. If a phrase reads fine with a comma or period, use that.
- **Comments read like a human wrote them mid-thought**, not polished technical prose. Explain why, not what. Interview-style thinking is welcome. See existing files in `src/lib/` and `src/app/g/[slug]/` for tone.
- **Complete file replacements** when editing. Don't send partial snippets.
- **No filler prose in responses.** The user prefers concise, direct answers.
- **Emojis only if the user asks.** They don't want them in code either.

## Durable invariants (do not break without discussion)

These are decisions worth preserving regardless of what phase the project is in.

**Money is always integer in the currency's smallest unit.** Cents for CAD/USD, yen for JPY, fils for KWD. Never floats. Every currency has a `minorUnitFactor` in `src/lib/currency.ts`: 1 for zero-decimal (JPY, KRW, VND, CLP, ISK, HUF, TWD, RWF, UGX, XAF, XOF), 1000 for three-decimal (BHD, JOD, KWD, OMR, TND), 100 for everything else. When touching amounts, use `minorToDisplay(amount, currency)` and `parseAmountToMinor(raw, currency)`. If you add a currency, verify its ISO 4217 minor-unit exponent.

**Split arithmetic normalizes to `{member, amount}` rows.** Equal, exact, and percent all end up as an `ExpenseShare[]` summing to the expense total. `src/lib/balances.ts` is pure, tested, and shouldn't be worked around.

**Balance math and settle-up live in `src/lib/balances.ts`.** Pure, no React, no Prisma. If a bug is reported there, add a failing test first, then fix.

## Current implementation (may evolve, don't treat as permanent)

Everything in this section reflects the app as it is today. Product decisions above these may change; consult `docs/handoff.md` before assuming.

**Access model right now:** share-link based. The group's `slug` (10-char nanoid) in the URL is the credential. No accounts, no auth. Every write and delete API route verifies the target resource belongs to the group named by `params.slug`. See `src/app/api/groups/[slug]/expenses/[id]/route.ts` for the pattern. If accounts are added later, this check stays as a defense-in-depth layer, but the primary auth mechanism will change.

**Data model right now:** no global `User` table. `Member` belongs to exactly one `Group`. This matches the current access model. If accounts land, expect a new `User` table and a `MemberProfile` or `UserGroupLink` relation, not a rewrite of `Member`.

**Cascades:** `Group -> Members/Expenses/Settlements` and `Expense -> ExpenseShare` cascade on delete. Hard deletes only, no soft-delete or audit log yet.

**Refresh model:** client components call `router.refresh()` after a mutation to re-run the server component. No optimistic UI, no client-side state store. Phase A is likely to add optimistic updates.

## File layout gotchas

- `src/app/api/groups/[slug]/expenses/[id]/route.ts` uses nested dynamic segments. Both `params.slug` and `params.id` are in scope.
- `src/app/g/[slug]/page.tsx` is a **server component** that fetches via Prisma directly. It passes the group down to `GroupView.tsx` which is a **client component**. Don't move Prisma calls into client components.
- `src/app/g/[slug]/GroupView.tsx` is the client shell. When you add a new section, wire it here.

## Testing

Pure logic goes in `src/lib/*.ts` with a colocated `*.test.ts`. Anything React or Prisma stays out of test files (Vitest is configured for node env, no jsdom). Current coverage: `balances.test.ts` (16 cases), `currency.test.ts` (6 cases). Add tests whenever you touch either lib.

Run `npm test` before committing changes to `src/lib/`.

## Prisma workflow

1. Edit `prisma/schema.prisma`
2. `npm run db:push` to apply to Neon (dev only, no migration history)
3. `npx prisma generate` if the client didn't auto-regenerate

For production we'd switch to `prisma migrate deploy`. Not set up yet.

## Vercel deploy

Auto-deploys on push to `main`. Env vars set in Vercel dashboard. The `postinstall` script runs `prisma generate` there so the client is available at runtime.

## When making non-trivial changes

- Read `docs/handoff.md` for current phase, roadmap, and open questions
- Match the tone of existing comments; don't polish them
- Prefer editing existing files over creating new ones
- If you add a new API route, follow the group-slug ownership check pattern (until access model changes)
- If you add UI, use existing Tailwind class patterns (see `ExpenseList.tsx`, `SettleUp.tsx`)

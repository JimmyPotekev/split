# Split — Project Handoff

Living reference for future Cowork sessions and Claude Code work. Update as decisions land.

## 1. What this is

Split is a no-signup, share-link-based group expense tracker. Create a group, add members by name, log expenses, get a minimum-transfer settle-up. Currently a working v0.1 deployed on Vercel with Neon Postgres.

## 2. MVP scope (travel groups, Canadian focus)

Primary user: a small group of friends taking a trip together. One person creates the group at trip start, shares the link, everyone logs expenses as the trip goes, they settle up at the end. That's the whole loop.

Canadian focus means:
- CAD default currency, USD/EUR/GBP/MXN/JPY also selectable
- Settlement UX should assume Interac e-Transfer as the payment rail (not Venmo, which is US-only). A future "Send Interac request" button that opens the bank app with pre-filled email + amount is the target integration, not Plaid or bank sync in v1
- Copy and defaults tuned for CAD residents, but nothing hardcodes country

## 3. Project structure

```
split/
  package.json              Next.js 14 + React 18 + TS + Prisma + Tailwind + Vitest
  tsconfig.json             strict, paths @/* -> src/*
  next.config.js            reactStrictMode: true, nothing else
  tailwind.config.ts        minimal, content: src/**/*.{ts,tsx}
  postcss.config.js         tailwind + autoprefixer
  vitest.config.ts          node env, src/**/*.test.ts
  .env.example              template for DATABASE_URL + DIRECT_URL
  .gitignore                node_modules, .next, .env, .env.local, .vercel

  prisma/
    schema.prisma           Group, Member, Expense, ExpenseShare, Settlement

  src/
    lib/
      db.ts                 Prisma client singleton, HMR-safe
      slug.ts               nanoid, 10-char alphabet excluding lookalikes
      balances.ts           pure splitEqual/splitExact/splitPercent, computeBalances, minimumTransfers
      balances.test.ts      16 vitest cases
      currency.ts           minorUnitFactor per ISO 4217, minorToDisplay, parseAmountToMinor
      currency.test.ts      6 vitest cases

    app/
      layout.tsx            root shell, imports globals.css
      globals.css           tailwind base + light theme + focus ring
      page.tsx              landing page, create-group form
      not-found.tsx         friendly 404 for bad slugs
      g/[slug]/
        page.tsx            server component, fetches group via Prisma
        GroupView.tsx       client shell (header with action buttons, two-column grid, drawer wiring)
        MemberManager.tsx  add/rename/remove members inline
        BalancePanel.tsx    per-member net balance rows
        SettleUp.tsx        suggested transfers + record button + custom form
        ExpenseForm.tsx     add-expense form (equal split only right now)
        ExpenseList.tsx     history rows (expenses + settlements interleaved by date, edit + delete buttons)
        EditExpenseModal.tsx  edit modal for expenses, pre-filled fields, PATCH submission
        EditSettlementModal.tsx  edit modal for settlements, pre-filled fields, PATCH submission
      api/
        groups/route.ts                     POST creates group + members
        groups/[slug]/route.ts              GET returns group + members + expenses + settlements
        groups/[slug]/expenses/route.ts     POST creates expense + shares
        groups/[slug]/expenses/[id]/route.ts   DELETE + PATCH with group-slug ownership check
        groups/[slug]/members/route.ts         POST adds member
        groups/[slug]/members/[id]/route.ts    DELETE + PATCH (rename), delete blocked if member has activity
        groups/[slug]/settlements/route.ts  POST creates settlement
        groups/[slug]/settlements/[id]/route.ts   DELETE + PATCH with group-slug ownership check

    components/
      ConfirmDialog.tsx     modal used by delete flows, esc + backdrop + focus ring
      Drawer.tsx            reusable slide-out panel from the right, used for Members + Settle up
```

## 4. Major decisions

**Stack.** Next.js 14 App Router + TypeScript, Prisma + Neon Postgres, Tailwind + hand-rolled components (no shadcn yet), Vitest for pure-logic tests. Deploy on Vercel. Alternatives considered: separate Vite/Express (rejected: two deploys, worse first-touch latency), Supabase (rejected: kills the "designed the REST API" story). One repo, one deploy.

**Data model.** No global User table. A `Member` belongs to exactly one `Group`. This matches the share-link access model. Splitting a group later means creating a new group. Amounts are integers in the currency's minor unit (cents for USD, yen for JPY). Never store floats. `ExpenseShare` normalizes all split types to `{member, amount}` rows summing to the total, so equal/exact/percent all use the same downstream code.

**Access control.** Share link is the credential. Anyone with the group's slug can view or mutate anything in that group. All DELETE endpoints verify `expense.group.slug === params.slug` to prevent cross-group tampering. There is no auth. A lightweight per-group passphrase for destructive actions is under consideration; full accounts are deferred to phase B.

**Bank / payment integration.** Not integrating with Plaid or Flinks in the near term. Path forward is a deep-link button on each suggested settlement: "Request via Interac" that opens the payer's bank app with a pre-filled amount and email address. Interac e-Transfer doesn't have a public consumer API, so this is client-side URL construction, not an OAuth flow. Deferred to phase D.

**Currency arithmetic.** Every currency has a `minorUnitFactor`: 1 for JPY/KRW/etc, 100 for USD/CAD/etc, 1000 for KWD/BHD. Fixed a bug where hardcoded ×100 caused JPY to store 100x actual value and drift balances by fractions of a yen. All split math operates in minor units, so splitEqual naturally handles indivisible-cent cases via largest-remainder distribution to the first N members.

**Slug entropy.** 10 chars from a 56-char lookalike-free alphabet (~58 bits). Not guessable in the "friends splitting bills" threat model. Retry on collision up to 3x in the create-group route.

## 5. Built vs stubbed

**Built and shipped:**
- Landing page with create-group form
- Group page with two-column desktop layout (expense form + balances), history below, members and settle-up in slide-out drawers
- Equal-split expenses
- Balance computation (memoized) + minimum-transfer settle-up
- Record suggested settlement OR custom settlement (any from/to/amount)
- Edit expense or settlement via modal (PATCH endpoints, shares recomputed on change)
- Delete expense or settlement via confirm modal
- Add/remove/rename members after group creation (delete blocked when member has activity)
- Multi-currency with proper minor-unit handling
- 22 unit tests passing (balances + currency)
- Deployed on Vercel with Neon prod DB
- Group settings: rename group, change currency (blocked once expenses/settlements exist)

**Schema supports but no UI yet:**
- Exact and percent split types (only "equal" wired through the form)
- Settlement `note` field (exposed in edit modal, not in create flow)

**Not built at all:**
- ~~Add/remove/rename members after group creation~~ Done
- ~~Rename group, change group currency~~ Done (archive deferred)
- Archive group (deferred until accounts / "my groups" list exist)
- Access control beyond "know the slug"
- Optimistic UI (every write round-trips before rendering)
- Offline queue
- Categories, receipts, notes, comments, recurring
- Real accounts, email/notifications
- Real-time sync across viewers
- Data export

## 6. Phase A (finish real MVP)

The list that turns v0.1 into something you'd actually recommend. Items are ordered by rough dependency, not priority.

1. ~~**Edit expense / settlement.**~~ Done. PATCH endpoints on both `expenses/[id]` and `settlements/[id]`. Edit modals (`EditExpenseModal`, `EditSettlementModal`) open from pencil icons on history rows. Expense PATCH recomputes shares in a transaction when amount or participants change. Settlement PATCH also exposes the `note` field.
2. ~~**Add / remove / rename members.**~~ Done. POST/DELETE/PATCH under `/api/groups/[slug]/members`. Delete blocked with 409 if the member has any expenses or settlements. MemberManager component in GroupView with inline rename and add form.
3. ~~**Group settings.**~~ Done (name + currency). PATCH `/api/groups/[slug]` for name and currency. Currency change is refused with 409 once any expense or settlement exists. `GroupSettings` component in a slide-out drawer. Archived flag deferred until accounts / "my groups" list make it meaningful.
4. **Exact and percent splits.** The math (`splitExact`, `splitPercent`) is done and tested. Only the form UI is missing. Add a split-type toggle in ExpenseForm; when exact, show per-participant amount fields with a running total; when percent, show per-participant % fields that must sum to 100.
5. **Passphrase-gated destructive actions.** Optional at group creation. When set, all DELETE and PATCH endpoints require an `X-Group-Pass` header. UI stores it in sessionStorage. Not real auth but keeps casual link-holders from wiping the group.
6. **Optimistic UI.** Wrap fetch calls in a small helper that updates local state immediately, reverts on failure. Biggest wins: add-expense (form should clear instantly), delete (row should disappear instantly), record-settlement (row should shrink instantly). Use React 19's `useOptimistic` if we bump versions, otherwise hand-rolled.
7. **Offline queue.** IndexedDB store of pending mutations. Service worker replays on reconnect. Overkill for v0.1 users but essential the moment someone tries to log a restaurant bill on airplane wifi. Consider deferring to phase B if it delays shipping.
8. **Empty states and polish.** Every list needs a real empty state with a call to action, not just "No X yet." Skeleton loaders where the server component fetches. Consistent error toasts (single toast component, not inline error strings scattered around).

## 7. Phase B (competitive product)

9. **Item-level splitting** (assign items from a receipt to specific people)
10. **Categories** (food/transport/lodging) with a breakdown chart
11. **Receipt photos** attached to expenses, stored in Vercel Blob or R2
12. **Notes and comments** on expenses
13. **Recurring expenses** for the roommate case
14. **Real accounts** (optional email login, groups still share-link)
15. **Multi-currency per expense** with FX conversion at transaction date (openexchangerates.org)
16. **Real-time sync** via SSE or Pusher
17. **Notifications** (email + push) for new expenses involving you
18. **Export** to CSV / PDF / shareable "trip summary" image
19. **Interac deep-link buttons** on suggested settlements

## 8. Phase C (feels like a product)

Notifications infra, real-time everywhere, PWA install for phone-native feel, watch widget, split templates ("bachelor party" preset), shared shopping list per group, Splitwise CSV import for migration.

## 9. Phase D (business ambition)

Bank integration via Flinks (Canada) or Plaid (US), full payment automation, business/team accounts, paid tier at ~$3 CAD/month for scan + sync + unlimited groups.

## 10. Open questions

- **Vertical focus.** Travel groups vs roommates vs couples. Right now the app leans travel (currency at group creation, "trip" language). Committing to one vertical would sharpen UX; staying general risks becoming a nicer Splitwise clone with no unique reason to switch.
- **Where accounts live.** If we add accounts in phase B, do they subsume the share-link model (accounts required, invited by email) or coexist (share links remain, accounts are optional convenience for people who want a group list). Prefer coexist to preserve the "no signup" superpower.
- **Delete semantics.** Should deleting an expense delete permanently or soft-delete for audit? Currently hard delete via Prisma cascade. Audit trail would let us build "activity feed" and undo, which are both useful.
- ~~**Currency change post-creation.**~~ Decided: refuse. Currency change is blocked (409) once any expense or settlement exists. Conversion was considered but has rounding and share-sum-drift risks that aren't worth the complexity for a rare operation. Empty groups can still change currency freely.
- **Interac deep-link format.** Need to verify what URL scheme the major Canadian bank apps actually accept, or whether we just fall back to `mailto:` with a formatted body.
- **Real-time approach.** SSE is simpler and free on Vercel; Pusher is turnkey but costs at scale. Decide at phase B start.
- **Rate limiting.** No rate limiting on API routes right now. Fine for private-link usage, essential the moment anything is publicly discoverable.
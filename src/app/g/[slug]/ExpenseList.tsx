'use client'

// Combined history: expenses AND settlements interleaved by date. Settlements
// render with a subtly different look so they don't visually compete with real
// expenses, but they're in the same list so the timeline reads chronologically.

import { centsToDisplay } from '@/lib/currency'

interface Share { memberId: string; amount: number }
interface Expense {
  id: string
  description: string
  amount: number
  date: string | Date
  payerId: string
  shares: Share[]
}
interface Settlement {
  id: string
  fromId: string
  toId: string
  amount: number
  date: string | Date
  note?: string | null
}
interface Member { id: string; name: string }

type Row =
  | { kind: 'expense'; date: Date; expense: Expense }
  | { kind: 'settlement'; date: Date; settlement: Settlement }

export default function ExpenseList({
  expenses,
  settlements,
  members,
  currency,
}: {
  expenses: Expense[]
  settlements: Settlement[]
  members: Member[]
  currency: string
}) {
  const nameById = new Map(members.map((m) => [m.id, m.name]))

  const rows: Row[] = [
    ...expenses.map((e) => ({
      kind: 'expense' as const,
      date: typeof e.date === 'string' ? new Date(e.date) : e.date,
      expense: e,
    })),
    ...settlements.map((s) => ({
      kind: 'settlement' as const,
      date: typeof s.date === 'string' ? new Date(s.date) : s.date,
      settlement: s,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No activity yet. Add your first expense below.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white shadow-sm">
      {rows.map((r) => {
        if (r.kind === 'expense') {
          const e = r.expense
          const payerName = nameById.get(e.payerId) ?? 'Someone'
          return (
            <li key={`e-${e.id}`} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{e.description}</p>
                <p className="text-xs text-zinc-500">
                  {payerName} paid · split {e.shares.length} way{e.shares.length === 1 ? '' : 's'} ·{' '}
                  {r.date.toLocaleDateString()}
                </p>
              </div>
              <p className="shrink-0 tabular-nums font-medium">
                {centsToDisplay(e.amount, currency)}
              </p>
            </li>
          )
        }
        const s = r.settlement
        const fromName = nameById.get(s.fromId) ?? 'Someone'
        const toName = nameById.get(s.toId) ?? 'Someone'
        return (
          <li
            key={`s-${s.id}`}
            className="flex items-center justify-between gap-4 bg-zinc-50/60 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-zinc-700">
                <span className="font-medium">{fromName}</span> paid{' '}
                <span className="font-medium">{toName}</span>
                {s.note ? <span className="text-zinc-500"> · {s.note}</span> : null}
              </p>
              <p className="text-xs text-zinc-500">
                Settlement · {r.date.toLocaleDateString()}
              </p>
            </div>
            <p className="shrink-0 tabular-nums font-medium text-zinc-700">
              {centsToDisplay(s.amount, currency)}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

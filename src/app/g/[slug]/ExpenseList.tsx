'use client'

// Read-only list of expenses. Each row shows: description, date, amount,
// who paid, how many people it was split among. Pure presentation.

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
interface Member { id: string; name: string }

export default function ExpenseList({
  expenses,
  members,
  currency,
}: {
  expenses: Expense[]
  members: Member[]
  currency: string
}) {
  const nameById = new Map(members.map((m) => [m.id, m.name]))

  if (expenses.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No expenses yet. Add your first one below.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white shadow-sm">
      {expenses.map((e) => {
        const date = typeof e.date === 'string' ? new Date(e.date) : e.date
        const payerName = nameById.get(e.payerId) ?? 'Someone'
        return (
          <li key={e.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{e.description}</p>
              <p className="text-xs text-zinc-500">
                {payerName} paid · split {e.shares.length} way{e.shares.length === 1 ? '' : 's'} ·{' '}
                {date.toLocaleDateString()}
              </p>
            </div>
            <p className="shrink-0 tabular-nums font-medium">
              {centsToDisplay(e.amount, currency)}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

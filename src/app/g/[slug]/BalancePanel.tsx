'use client'

// Shows each person's net position: how much they're owed (green) or owe (red).
// Pure derived state from expenses + settlements. Memoized so we don't re-run
// the math on every unrelated re-render.

import { useMemo } from 'react'
import { computeBalances } from '@/lib/balances'
import { minorToDisplay } from '@/lib/currency'

interface Member { id: string; name: string }
interface Share { memberId: string; amount: number }
interface Expense { payerId: string; amount: number; shares: Share[] }
interface Settlement { fromId: string; toId: string; amount: number }

export default function BalancePanel({
  members,
  expenses,
  settlements,
  currency,
}: {
  members: Member[]
  expenses: Expense[]
  settlements: Settlement[]
  currency: string
}) {
  const balances = useMemo(
    () => computeBalances(members.map((m) => m.id), expenses, settlements),
    [members, expenses, settlements]
  )

  const rows = useMemo(() => {
    return members
      .map((m) => ({ member: m, balance: balances[m.id] ?? 0 }))
      .sort((a, b) => b.balance - a.balance)
  }, [members, balances])

  const allZero = rows.every((r) => r.balance === 0)

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <ul className="divide-y divide-zinc-200">
        {rows.map((r) => (
          <li key={r.member.id} className="flex items-center justify-between px-4 py-3">
            <span className="font-medium">{r.member.name}</span>
            <span
              className={
                'tabular-nums font-medium ' +
                (r.balance > 0
                  ? 'text-emerald-700'
                  : r.balance < 0
                    ? 'text-red-600'
                    : 'text-zinc-500')
              }
            >
              {r.balance > 0 && '+'}
              {minorToDisplay(r.balance, currency)}
              <span className="ml-2 text-xs font-normal text-zinc-500">
                {r.balance > 0 ? 'is owed' : r.balance < 0 ? 'owes' : 'settled'}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {allZero && (
        <p className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500">
          Everyone's settled up.
        </p>
      )}
    </div>
  )
}

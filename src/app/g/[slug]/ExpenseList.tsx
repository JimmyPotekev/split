'use client'

// Combined history: expenses AND settlements interleaved by date. Delete flows
// through the shared ConfirmDialog so it looks like a real app, not a browser
// alert. Pending state ({ kind, id, label }) drives both which row shows the
// spinner and what the dialog says.
//
// Edit flows open a modal pre-filled with the existing data.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { minorToDisplay } from '@/lib/currency'
import ConfirmDialog from '@/components/ConfirmDialog'
import EditExpenseModal from './EditExpenseModal'
import EditSettlementModal from './EditSettlementModal'

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

type Pending = { kind: 'expense' | 'settlement'; id: string; label: string }

export default function ExpenseList({
  slug,
  expenses,
  settlements,
  members,
  currency,
}: {
  slug: string
  expenses: Expense[]
  settlements: Settlement[]
  members: Member[]
  currency: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingSettlement, setEditingSettlement] = useState<Settlement | null>(null)
  const nameById = new Map(members.map((m) => [m.id, m.name]))

  async function confirmDelete() {
    if (!pending) return
    setBusy(true)
    try {
      const path = pending.kind === 'expense' ? 'expenses' : 'settlements'
      const res = await fetch(`/api/groups/${slug}/${path}/${pending.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Delete failed')
      setPending(null)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

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
        No activity yet. Add your first expense above.
      </p>
    )
  }

  return (
    <>
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white shadow-sm">
        {rows.map((r) => {
          if (r.kind === 'expense') {
            const e = r.expense
            const payerName = nameById.get(e.payerId) ?? 'Someone'
            const isPending = pending?.id === e.id
            return (
              <li
                key={`e-${e.id}`}
                className="group flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.description}</p>
                  <p className="text-xs text-zinc-500">
                    {payerName} paid · split {e.shares.length} way{e.shares.length === 1 ? '' : 's'} ·{' '}
                    {r.date.toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <p className="tabular-nums font-medium">
                    {minorToDisplay(e.amount, currency)}
                  </p>
                  <button
                    onClick={() => setEditingExpense(e)}
                    className="text-zinc-400 opacity-0 transition hover:text-zinc-700 group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Edit ${e.description}`}
                    title="Edit"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
                      <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 1 14 9v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
                    </svg>
                  </button>
                  <button
                    onClick={() =>
                      setPending({ kind: 'expense', id: e.id, label: e.description })
                    }
                    disabled={isPending}
                    className="text-zinc-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100 disabled:opacity-50 focus:opacity-100"
                    aria-label={`Delete ${e.description}`}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </li>
            )
          }
          const s = r.settlement
          const fromName = nameById.get(s.fromId) ?? 'Someone'
          const toName = nameById.get(s.toId) ?? 'Someone'
          const label = `${fromName} → ${toName}`
          const isPending = pending?.id === s.id
          return (
            <li
              key={`s-${s.id}`}
              className="group flex items-center justify-between gap-4 bg-zinc-50/60 px-4 py-3"
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
              <div className="flex shrink-0 items-center gap-2">
                <p className="tabular-nums font-medium text-zinc-700">
                  {minorToDisplay(s.amount, currency)}
                </p>
                <button
                  onClick={() => setEditingSettlement(s)}
                  className="text-zinc-400 opacity-0 transition hover:text-zinc-700 group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Edit settlement ${label}`}
                  title="Edit"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
                    <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 1 14 9v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
                  </svg>
                </button>
                <button
                  onClick={() =>
                    setPending({ kind: 'settlement', id: s.id, label })
                  }
                  disabled={isPending}
                  className="text-zinc-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100 disabled:opacity-50 focus:opacity-100"
                  aria-label={`Delete settlement ${label}`}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'settlement' ? 'Delete settlement?' : 'Delete expense?'}
        message={
          <>
            <span className="font-medium text-zinc-900">{pending?.label}</span>
            <span> will be removed from the history and balances will update.</span>
          </>
        }
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => !busy && setPending(null)}
      />

      {editingExpense && (
        <EditExpenseModal
          slug={slug}
          expense={editingExpense}
          members={members}
          currency={currency}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {editingSettlement && (
        <EditSettlementModal
          slug={slug}
          settlement={editingSettlement}
          members={members}
          currency={currency}
          onClose={() => setEditingSettlement(null)}
        />
      )}
    </>
  )
}

'use client'

// Combined history: expenses AND settlements interleaved by date. Delete is
// optimistic now: the row disappears the moment you confirm, and comes back
// if the server rejects the delete.
//
// Edit flows still wait for the server (they show a modal with a loading state,
// which is fine UX for edits). Expense rows expand inline to show breakdown.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { minorToDisplay } from '@/lib/currency'
import ConfirmDialog from '@/components/ConfirmDialog'
import { isPassphraseError } from '@/components/PassphrasePrompt'
import EditExpenseModal from './EditExpenseModal'
import EditSettlementModal from './EditSettlementModal'
import type { OptimisticResult } from './GroupView'

interface Share { memberId: string; amount: number }
interface Expense {
  id: string
  description: string
  amount: number
  date: string | Date
  payerId: string
  splitType?: string
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

function splitLabel(type?: string): string {
  if (type === 'exact') return 'exact'
  if (type === 'percent') return 'percent'
  return 'equal'
}

export default function ExpenseList({
  slug,
  expenses,
  settlements,
  members,
  currency,
  passphrase,
  hasPassphrase,
  onPassphraseNeeded,
  onPassphraseWrong,
  onOptimisticRemoveExpense,
  onOptimisticRemoveSettlement,
}: {
  slug: string
  expenses: Expense[]
  settlements: Settlement[]
  members: Member[]
  currency: string
  passphrase?: string | null
  hasPassphrase?: boolean
  onPassphraseNeeded?: () => void
  onPassphraseWrong?: () => void
  onOptimisticRemoveExpense?: (id: string) => OptimisticResult
  onOptimisticRemoveSettlement?: (id: string) => OptimisticResult
}) {
  const router = useRouter()
  const [pending, setPending] = useState<Pending | null>(null)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingSettlement, setEditingSettlement] = useState<Settlement | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const nameById = new Map(members.map((m) => [m.id, m.name]))

  function passphraseHeaders(): Record<string, string> {
    const h: Record<string, string> = {}
    if (passphrase) h['X-Group-Pass'] = passphrase
    return h
  }

  async function confirmDelete() {
    if (!pending) return
    if (hasPassphrase && !passphrase) {
      onPassphraseNeeded?.()
      return
    }

    const { kind, id } = pending
    const removeFn = kind === 'expense' ? onOptimisticRemoveExpense : onOptimisticRemoveSettlement
    const result = removeFn?.(id)

    // close dialog and remove row immediately
    setPending(null)

    const path = kind === 'expense' ? 'expenses' : 'settlements'
    try {
      const res = await fetch(`/api/groups/${slug}/${path}/${id}`, {
        method: 'DELETE',
        headers: passphraseHeaders(),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (isPassphraseError(body)) {
          result?.revert()
          onPassphraseWrong?.()
          return
        }
        throw new Error('Delete failed')
      }
      result?.confirm()
      router.refresh()
    } catch (err) {
      result?.revert()
      alert(err instanceof Error ? err.message : 'Delete failed')
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
            const isExpanded = expandedId === e.id
            const isOptimistic = e.id.startsWith('optimistic-')
            return (
              <li key={`e-${e.id}`} className={isOptimistic ? 'opacity-70' : undefined}>
                <div className="group flex items-center justify-between gap-4 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : e.id)}
                    className="min-w-0 text-left"
                  >
                    <p className="truncate font-medium">{e.description}</p>
                    <p className="text-xs text-zinc-500">
                      {payerName} paid · {splitLabel(e.splitType)} split {e.shares.length} way{e.shares.length === 1 ? '' : 's'} ·{' '}
                      {r.date.toLocaleDateString()}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <p className="tabular-nums font-medium text-right min-w-[5rem]">
                      {minorToDisplay(e.amount, currency)}
                    </p>
                    <div className="flex items-center gap-2 w-[4.5rem] justify-end">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : e.id)}
                        className={'text-zinc-400 transition hover:text-zinc-700 ' + (isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100')}
                        aria-label={isExpanded ? 'Collapse breakdown' : 'Show breakdown'}
                        title={isExpanded ? 'Collapse' : 'Show breakdown'}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className={'h-3.5 w-3.5 transition-transform ' + (isExpanded ? 'rotate-180' : '')}
                        >
                          <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {!isOptimistic && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-2">
                      Breakdown ({splitLabel(e.splitType)} split)
                    </p>
                    <ul className="space-y-1">
                      {e.shares.map((s) => {
                        const name = nameById.get(s.memberId) ?? 'Unknown'
                        const pct = e.amount > 0 ? Math.round((s.amount / e.amount) * 100) : 0
                        return (
                          <li key={s.memberId} className="flex items-center justify-between text-sm">
                            <span className="text-zinc-700">{name}</span>
                            <span className="tabular-nums text-zinc-600">
                              {minorToDisplay(s.amount, currency)}
                              {e.splitType !== 'equal' && (
                                <span className="ml-1.5 text-xs text-zinc-400">({pct}%)</span>
                              )}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </li>
            )
          }
          const s = r.settlement
          const fromName = nameById.get(s.fromId) ?? 'Someone'
          const toName = nameById.get(s.toId) ?? 'Someone'
          const label = `${fromName} → ${toName}`
          const isPending = pending?.id === s.id
          const isOptimistic = s.id.startsWith('optimistic-')
          return (
            <li
              key={`s-${s.id}`}
              className={'group flex items-center justify-between gap-4 bg-zinc-50/60 px-4 py-3' + (isOptimistic ? ' opacity-70' : '')}
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
                <p className="tabular-nums font-medium text-zinc-700 text-right min-w-[5rem]">
                  {minorToDisplay(s.amount, currency)}
                </p>
                {!isOptimistic && (
                  <div className="flex items-center gap-2 w-[4.5rem] justify-end">
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
                )}
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
        busy={false}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />

      {editingExpense && (
        <EditExpenseModal
          slug={slug}
          expense={editingExpense}
          members={members}
          currency={currency}
          passphrase={passphrase}
          hasPassphrase={hasPassphrase}
          onPassphraseNeeded={onPassphraseNeeded}
          onPassphraseWrong={onPassphraseWrong}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {editingSettlement && (
        <EditSettlementModal
          slug={slug}
          settlement={editingSettlement}
          members={members}
          currency={currency}
          passphrase={passphrase}
          hasPassphrase={hasPassphrase}
          onPassphraseNeeded={onPassphraseNeeded}
          onPassphraseWrong={onPassphraseWrong}
          onClose={() => setEditingSettlement(null)}
        />
      )}
    </>
  )
}

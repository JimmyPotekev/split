'use client'

// Modal for editing an existing expense. Same fields as ExpenseForm but
// pre-filled and submits a PATCH instead of POST.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { minorToDisplay, parseAmountToMinor, minorUnitFactor } from '@/lib/currency'

interface Member { id: string; name: string }
interface Share { memberId: string; amount: number }
interface Expense {
  id: string
  description: string
  amount: number
  date: string | Date
  payerId: string
  shares: Share[]
}

export default function EditExpenseModal({
  slug,
  expense,
  members,
  currency,
  onClose,
}: {
  slug: string
  expense: Expense
  members: Member[]
  currency: string
  onClose: () => void
}) {
  const router = useRouter()
  const factor = minorUnitFactor(currency)
  const displayAmount = (expense.amount / factor).toFixed(factor === 1 ? 0 : factor === 1000 ? 3 : 2)

  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount] = useState(displayAmount)
  const [payerId, setPayerId] = useState(expense.payerId)
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    new Set(expense.shares.map((s) => s.memberId))
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleParticipant(id: string) {
    setParticipantIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const minor = parseAmountToMinor(amount, currency)
    if (!description.trim()) return setError('Add a description.')
    if (minor === null || minor <= 0) return setError('Amount must be a positive number.')
    if (!payerId) return setError('Pick a payer.')
    if (participantIds.size === 0) return setError('Pick at least one participant.')

    setSubmitting(true)
    try {
      const res = await fetch(`/api/groups/${slug}/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          amount: minor,
          payerId,
          participantIds: [...participantIds],
          splitType: 'equal',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Could not save expense.')
      }
      onClose()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        aria-label="Close"
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-black/40"
        tabIndex={-1}
      />
      <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-zinc-900">Edit expense</h3>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was it for?"
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="w-32 rounded-md border border-zinc-300 px-3 py-2 text-right"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Paid by
              </label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Split among
              </label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const on = participantIds.has(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleParticipant(m.id)}
                      className={
                        'rounded-full border px-3 py-1 text-sm transition ' +
                        (on
                          ? 'bg-zinc-900 border-zinc-900 text-white'
                          : 'bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50')
                      }
                      aria-pressed={on}
                    >
                      {m.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white font-medium hover:bg-zinc-800 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

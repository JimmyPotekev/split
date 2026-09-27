'use client'

// Modal for editing an existing settlement. Same fields as CustomSettlementForm
// but pre-filled, submits PATCH.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseAmountToMinor, minorUnitFactor } from '@/lib/currency'

interface Member { id: string; name: string }
interface Settlement {
  id: string
  fromId: string
  toId: string
  amount: number
  date: string | Date
  note?: string | null
}

export default function EditSettlementModal({
  slug,
  settlement,
  members,
  currency,
  onClose,
}: {
  slug: string
  settlement: Settlement
  members: Member[]
  currency: string
  onClose: () => void
}) {
  const router = useRouter()
  const factor = minorUnitFactor(currency)
  const displayAmount = (settlement.amount / factor).toFixed(factor === 1 ? 0 : factor === 1000 ? 3 : 2)

  const [fromId, setFromId] = useState(settlement.fromId)
  const [toId, setToId] = useState(settlement.toId)
  const [amount, setAmount] = useState(displayAmount)
  const [note, setNote] = useState(settlement.note ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const minor = parseAmountToMinor(amount, currency)
    if (fromId === toId) return setError("From and to can't be the same person.")
    if (minor === null || minor <= 0) return setError('Amount must be a positive number.')

    setSubmitting(true)
    try {
      const res = await fetch(`/api/groups/${slug}/settlements/${settlement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromId,
          toId,
          amount: minor,
          note: note.trim() || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Could not update settlement.')
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
        <h3 className="text-base font-semibold text-zinc-900">Edit settlement</h3>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
            <select
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <span className="self-center text-sm text-zinc-500">pays</span>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="w-28 rounded-md border border-zinc-300 px-3 py-2 text-right"
            />
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />

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

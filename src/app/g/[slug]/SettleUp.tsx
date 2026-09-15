'use client'

// Suggested settle-up transfers. Runs minimumTransfers on current balances,
// shows each suggested payment as a row with a "Record" button that POSTs a
// settlement. After recording, the page refreshes and the balances shrink.
//
// Also handles fully-custom settlements via a small "or record a different
// payment" toggle at the bottom, for cases like: someone paid outside the
// suggested set, or split a settlement differently than the tool suggests.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { computeBalances, minimumTransfers } from '@/lib/balances'
import { centsToDisplay, parseAmountToCents } from '@/lib/currency'

interface Member { id: string; name: string }
interface Share { memberId: string; amount: number }
interface Expense { payerId: string; amount: number; shares: Share[] }
interface Settlement { fromId: string; toId: string; amount: number }

export default function SettleUp({
  slug,
  members,
  expenses,
  settlements,
  currency,
}: {
  slug: string
  members: Member[]
  expenses: Expense[]
  settlements: Settlement[]
  currency: string
}) {
  const router = useRouter()
  const [recording, setRecording] = useState<string | null>(null) // transfer key being recorded
  const [error, setError] = useState<string | null>(null)
  const [showCustom, setShowCustom] = useState(false)

  const transfers = useMemo(() => {
    const balances = computeBalances(members.map((m) => m.id), expenses, settlements)
    return minimumTransfers(balances)
  }, [members, expenses, settlements])

  const nameById = new Map(members.map((m) => [m.id, m.name]))

  async function record(fromId: string, toId: string, amount: number, key: string) {
    setError(null)
    setRecording(key)
    try {
      const res = await fetch(`/api/groups/${slug}/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId, toId, amount }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Could not record.')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.')
    } finally {
      setRecording(null)
    }
  }

  if (transfers.length === 0 && !showCustom) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-zinc-500">Nothing to settle. Everyone's even.</p>
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className="mt-2 text-xs text-sky-700 hover:underline"
        >
          Record a payment anyway
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {transfers.length > 0 && (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white shadow-sm">
          {transfers.map((t, i) => {
            const key = `${t.fromId}-${t.toId}-${i}`
            const from = nameById.get(t.fromId) ?? 'Someone'
            const to = nameById.get(t.toId) ?? 'Someone'
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0 text-sm">
                  <span className="font-medium">{from}</span>
                  <span className="text-zinc-500"> pays </span>
                  <span className="font-medium">{to}</span>
                  <span className="ml-2 tabular-nums text-zinc-900">
                    {centsToDisplay(t.amount, currency)}
                  </span>
                </div>
                <button
                  onClick={() => record(t.fromId, t.toId, t.amount, key)}
                  disabled={recording !== null}
                  className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white font-medium hover:bg-zinc-800 disabled:opacity-50"
                >
                  {recording === key ? 'Recording…' : 'Record'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!showCustom ? (
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className="text-xs text-sky-700 hover:underline"
        >
          Record a different payment
        </button>
      ) : (
        <CustomSettlementForm
          slug={slug}
          members={members}
          onDone={() => {
            setShowCustom(false)
            router.refresh()
          }}
          onCancel={() => setShowCustom(false)}
        />
      )}
    </div>
  )
}

function CustomSettlementForm({
  slug,
  members,
  onDone,
  onCancel,
}: {
  slug: string
  members: Member[]
  onDone: () => void
  onCancel: () => void
}) {
  const [fromId, setFromId] = useState(members[0]?.id ?? '')
  const [toId, setToId] = useState(members[1]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const cents = parseAmountToCents(amount)
    if (fromId === toId) return setError("From and to can't be the same person.")
    if (cents === null || cents <= 0) return setError('Amount must be a positive number.')

    setSubmitting(true)
    try {
      const res = await fetch(`/api/groups/${slug}/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId, toId, amount: cents }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Could not record.')
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm space-y-3"
    >
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white font-medium hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? 'Recording…' : 'Record payment'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

'use client'

// Add-expense form. Kept below the expense list so the list is what people
// see first when the page loads. Defaults: payer = first member, participants
// = everyone. Two clicks + typing to log a typical expense.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseAmountToMinor } from '@/lib/currency'

interface Member { id: string; name: string }

export default function ExpenseForm({
  slug,
  members,
  currency,
}: {
  slug: string
  members: Member[]
  currency: string
}) {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [payerId, setPayerId] = useState(members[0]?.id ?? '')
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    new Set(members.map((m) => m.id))
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
      const res = await fetch(`/api/groups/${slug}/expenses`, {
        method: 'POST',
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
      setDescription('')
      setAmount('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm space-y-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was it for?  e.g. Dinner at Casa Oaxaca"
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
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
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

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-white font-medium hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? 'Adding…' : 'Add expense'}
      </button>
    </form>
  )
}

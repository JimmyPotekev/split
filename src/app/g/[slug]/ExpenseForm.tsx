'use client'

// Add-expense form. Defaults: payer = first member, participants = everyone,
// split type = equal. For exact split, per-participant amount fields appear
// with a running total. For percent, per-participant % fields that must sum
// to 100.

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { parseAmountToMinor, minorToDisplay, minorUnitFactor } from '@/lib/currency'

interface Member { id: string; name: string }

type SplitType = 'equal' | 'exact' | 'percent'

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
  const [splitType, setSplitType] = useState<SplitType>('equal')
  const [exactInputs, setExactInputs] = useState<Record<string, string>>({})
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const factor = minorUnitFactor(currency)
  const decimals = factor === 1 ? 0 : factor === 1000 ? 3 : 2

  const participantMembers = useMemo(
    () => members.filter((m) => participantIds.has(m.id)),
    [members, participantIds]
  )

  function toggleParticipant(id: string) {
    setParticipantIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // running totals for the UI hints
  const exactTotal = useMemo(() => {
    let sum = 0
    for (const m of participantMembers) {
      const v = parseAmountToMinor(exactInputs[m.id] ?? '', currency)
      if (v !== null) sum += v
    }
    return sum
  }, [exactInputs, participantMembers, currency])

  const percentTotal = useMemo(() => {
    let sum = 0
    for (const m of participantMembers) {
      const v = parseInt(percentInputs[m.id] ?? '', 10)
      if (Number.isFinite(v)) sum += v
    }
    return sum
  }, [percentInputs, participantMembers])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const minor = parseAmountToMinor(amount, currency)
    if (!description.trim()) return setError('Add a description.')
    if (minor === null || minor <= 0) return setError('Amount must be a positive number.')
    if (!payerId) return setError('Pick a payer.')
    if (participantIds.size === 0) return setError('Pick at least one participant.')

    const payload: Record<string, unknown> = {
      description: description.trim(),
      amount: minor,
      payerId,
      splitType,
    }

    if (splitType === 'equal') {
      payload.participantIds = [...participantIds]
    } else if (splitType === 'exact') {
      const exactAmounts = participantMembers.map((m) => {
        const v = parseAmountToMinor(exactInputs[m.id] ?? '', currency)
        return { memberId: m.id, amount: v ?? 0 }
      })
      const sum = exactAmounts.reduce((s, r) => s + r.amount, 0)
      if (sum !== minor) {
        return setError(`Exact amounts sum to ${minorToDisplay(sum, currency)}, but the total is ${minorToDisplay(minor, currency)}.`)
      }
      payload.exactAmounts = exactAmounts
    } else {
      const percentages = participantMembers.map((m) => {
        const v = parseInt(percentInputs[m.id] ?? '', 10)
        return { memberId: m.id, percent: Number.isFinite(v) ? v : 0 }
      })
      const sum = percentages.reduce((s, r) => s + r.percent, 0)
      if (sum !== 100) {
        return setError(`Percentages sum to ${sum}%, must be exactly 100%.`)
      }
      payload.percentages = percentages
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/groups/${slug}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Could not save expense.')
      }
      setDescription('')
      setAmount('')
      setExactInputs({})
      setPercentInputs({})
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

      {/* Split type toggle */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Split type
        </label>
        <div className="mt-1 inline-flex rounded-md border border-zinc-300 overflow-hidden">
          {(['equal', 'exact', 'percent'] as SplitType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSplitType(t)}
              className={
                'px-3 py-1.5 text-sm font-medium transition ' +
                (t === splitType
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-50') +
                (t !== 'equal' ? ' border-l border-zinc-300' : '')
              }
            >
              {t === 'equal' ? 'Equal' : t === 'exact' ? 'Exact' : 'Percent'}
            </button>
          ))}
        </div>
      </div>

      {/* Per-participant fields for exact split */}
      {splitType === 'exact' && participantMembers.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Amount per person
          </label>
          {participantMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="w-28 truncate text-sm text-zinc-700">{m.name}</span>
              <input
                value={exactInputs[m.id] ?? ''}
                onChange={(e) => setExactInputs((prev) => ({ ...prev, [m.id]: e.target.value }))}
                placeholder={`0.${'0'.repeat(decimals)}`}
                inputMode="decimal"
                className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-right text-sm"
              />
            </div>
          ))}
          <p className="text-xs text-zinc-500">
            Running total: {minorToDisplay(exactTotal, currency)}
            {amount && parseAmountToMinor(amount, currency) !== null && (
              <>
                {' / '}
                {minorToDisplay(parseAmountToMinor(amount, currency)!, currency)}
                {exactTotal === parseAmountToMinor(amount, currency)! ? (
                  <span className="ml-1 text-green-600 font-medium">Matches</span>
                ) : (
                  <span className="ml-1 text-amber-600 font-medium">
                    {exactTotal < parseAmountToMinor(amount, currency)!
                      ? `${minorToDisplay(parseAmountToMinor(amount, currency)! - exactTotal, currency)} remaining`
                      : `${minorToDisplay(exactTotal - parseAmountToMinor(amount, currency)!, currency)} over`}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
      )}

      {/* Per-participant fields for percent split */}
      {splitType === 'percent' && participantMembers.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Percent per person
          </label>
          {participantMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="w-28 truncate text-sm text-zinc-700">{m.name}</span>
              <input
                value={percentInputs[m.id] ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '')
                  setPercentInputs((prev) => ({ ...prev, [m.id]: raw }))
                }}
                placeholder="0"
                inputMode="numeric"
                className="w-20 rounded-md border border-zinc-300 px-3 py-1.5 text-right text-sm"
              />
              <span className="text-sm text-zinc-500">%</span>
            </div>
          ))}
          <p className="text-xs text-zinc-500">
            Total: {percentTotal}%
            {percentTotal === 100 ? (
              <span className="ml-1 text-green-600 font-medium">Matches</span>
            ) : (
              <span className="ml-1 text-amber-600 font-medium">
                {percentTotal < 100
                  ? `${100 - percentTotal}% remaining`
                  : `${percentTotal - 100}% over`}
              </span>
            )}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-white font-medium hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? 'Adding...' : 'Add expense'}
      </button>
    </form>
  )
}

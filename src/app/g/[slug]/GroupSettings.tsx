'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'MXN', label: 'MXN — Mexican Peso' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
]

export default function GroupSettings({
  slug,
  name,
  currency,
  hasActivity,
}: {
  slug: string
  name: string
  currency: string
  hasActivity: boolean
}) {
  const router = useRouter()
  const [editName, setEditName] = useState(name)
  const [editCurrency, setEditCurrency] = useState(currency)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const nameChanged = editName.trim() !== name
  const currencyChanged = editCurrency !== currency
  const hasChanges = nameChanged || currencyChanged

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!hasChanges) return
    setError(null)
    setSuccess(null)
    setBusy(true)

    const patch: Record<string, string> = {}
    if (nameChanged) patch.name = editName.trim()
    if (currencyChanged) patch.currency = editCurrency

    try {
      const res = await fetch(`/api/groups/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Could not update group.')
      }
      setSuccess('Saved.')
      setTimeout(() => setSuccess(null), 2000)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-5 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <label htmlFor="group-name" className="block text-sm font-medium text-zinc-700">
          Group name
        </label>
        <input
          id="group-name"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm"
          disabled={busy}
        />
      </div>

      <div>
        <label htmlFor="group-currency" className="block text-sm font-medium text-zinc-700">
          Currency
        </label>
        <select
          id="group-currency"
          value={editCurrency}
          onChange={(e) => setEditCurrency(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm disabled:opacity-50"
          disabled={busy || hasActivity}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        {hasActivity && (
          <p className="mt-1 text-xs text-zinc-500">
            Currency cannot be changed after expenses or settlements have been recorded.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <button
        type="submit"
        disabled={busy || !hasChanges || !editName.trim()}
        className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? 'Saving...' : 'Save changes'}
      </button>
    </form>
  )
}

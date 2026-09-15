'use client'

// Landing page. Whole app boils down to: create a group, get a shareable URL.
// No auth, no email, no signup, just "here's a link, everyone with it can add expenses".

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  // Start with two empty member rows. Feels less intimidating than one, and a
  // group of one doesn't really need this app.
  const [members, setMembers] = useState<string[]>(['', ''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateMember(i: number, value: string) {
    setMembers((prev) => prev.map((m, idx) => (idx === i ? value : m)))
  }

  function addMember() {
    setMembers((prev) => [...prev, ''])
  }

  function removeMember(i: number) {
    setMembers((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    const memberNames = members.map((m) => m.trim()).filter(Boolean)
    if (!trimmedName) return setError('Give the group a name.')
    if (memberNames.length < 2) return setError('Add at least two people.')

    setSubmitting(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, currency, members: memberNames }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Something broke on our end.')
      }
      const { slug } = await res.json()
      router.push(`/g/${slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.')
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Split</h1>
      <p className="mt-2 text-zinc-600">
        Share expenses with a group. No signup, no accounts. Just a link.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Group name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cabo 2026"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 shadow-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 shadow-sm"
          >
            {/* small set for now, can grow later */}
            <option value="USD">USD — US Dollar</option>
            <option value="CAD">CAD — Canadian Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="MXN">MXN — Mexican Peso</option>
            <option value="JPY">JPY — Japanese Yen</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">People</label>
          <div className="mt-1 space-y-2">
            {members.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={m}
                  onChange={(e) => updateMember(i, e.target.value)}
                  placeholder={`Person ${i + 1}`}
                  className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 shadow-sm"
                />
                {members.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeMember(i)}
                    className="rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-600 hover:bg-zinc-50"
                    aria-label={`Remove person ${i + 1}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addMember}
            className="mt-2 text-sm text-sky-700 hover:underline"
          >
            + Add another person
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-white font-medium hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create group'}
        </button>
      </form>
    </main>
  )
}

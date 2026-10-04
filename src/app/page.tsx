'use client'

// Landing page. Whole app boils down to: create a group, get a shareable URL.
// No auth, no email, no signup, just "here's a link, everyone with it can add expenses".

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Phase = 'idle' | 'creating' | 'redirecting'

export default function LandingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  // Start with two empty member rows. Feels less intimidating than one, and a
  // group of one doesn't really need this app.
  const [members, setMembers] = useState<string[]>(['', ''])
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
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
    if (passphrase && passphrase !== confirmPassphrase) {
      return setError('Passphrases do not match.')
    }

    setPhase('creating')
    try {
      const body: Record<string, unknown> = {
        name: trimmedName,
        currency,
        members: memberNames,
      }
      if (passphrase) body.passphrase = passphrase

      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Something broke on our end.')
      }
      const { slug } = await res.json()

      if (passphrase) {
        try {
          sessionStorage.setItem(`split-passphrase-${slug}`, passphrase)
        } catch {
          // ignore
        }
      }

      setPhase('redirecting')
      router.push(`/g/${slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.')
      setPhase('idle')
    }
  }

  const busy = phase !== 'idle'

  return (
    <>
      {phase === 'redirecting' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm transition-opacity">
          <Spinner size={32} />
          <p className="mt-4 text-sm font-medium text-zinc-600">Opening your group...</p>
        </div>
      )}

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

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Passphrase <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <p className="mt-0.5 text-xs text-zinc-500">
              When set, editing and deleting items will require this passphrase.
            </p>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Leave empty for no protection"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 shadow-sm"
              autoComplete="off"
            />
            {passphrase && (
              <input
                type="password"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Confirm passphrase"
                className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 shadow-sm"
                autoComplete="off"
              />
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-white font-medium hover:bg-zinc-800 disabled:opacity-70"
          >
            {busy && <Spinner size={16} />}
            {phase === 'creating' ? 'Creating...' : phase === 'redirecting' ? 'Opening...' : 'Create group'}
          </button>
        </form>
      </main>
    </>
  )
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
    >
      <circle
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-75"
      />
    </svg>
  )
}

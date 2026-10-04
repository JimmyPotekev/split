'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPassphraseError } from '@/components/PassphrasePrompt'

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
  passphrase,
  hasPassphrase,
  onPassphraseNeeded,
  onPassphraseWrong,
  onPassphraseChanged,
}: {
  slug: string
  name: string
  currency: string
  hasActivity: boolean
  passphrase?: string | null
  hasPassphrase?: boolean
  onPassphraseNeeded?: () => void
  onPassphraseWrong?: () => void
  onPassphraseChanged?: (newPassphrase: string | null) => void
}) {
  const router = useRouter()
  const [editName, setEditName] = useState(name)
  const [editCurrency, setEditCurrency] = useState(currency)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [newPassphrase, setNewPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [passphraseBusy, setPassphraseBusy] = useState(false)
  const [passphraseError, setPassphraseError] = useState<string | null>(null)
  const [passphraseSuccess, setPassphraseSuccess] = useState<string | null>(null)

  const nameChanged = editName.trim() !== name
  const currencyChanged = editCurrency !== currency
  const hasChanges = nameChanged || currencyChanged

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!hasChanges) return
    if (hasPassphrase && !passphrase) {
      onPassphraseNeeded?.()
      return
    }
    setError(null)
    setSuccess(null)
    setBusy(true)

    const patch: Record<string, string> = {}
    if (nameChanged) patch.name = editName.trim()
    if (currencyChanged) patch.currency = editCurrency

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (passphrase) headers['X-Group-Pass'] = passphrase

      const res = await fetch(`/api/groups/${slug}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (isPassphraseError(body)) {
          onPassphraseWrong?.()
          return
        }
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

  async function savePassphrase(e: React.FormEvent) {
    e.preventDefault()
    setPassphraseError(null)
    setPassphraseSuccess(null)

    if (newPassphrase && newPassphrase !== confirmPassphrase) {
      return setPassphraseError('Passphrases do not match.')
    }

    if (hasPassphrase && !passphrase) {
      onPassphraseNeeded?.()
      return
    }

    setPassphraseBusy(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (passphrase) headers['X-Group-Pass'] = passphrase

      const res = await fetch(`/api/groups/${slug}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ passphrase: newPassphrase || '' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (isPassphraseError(body)) {
          onPassphraseWrong?.()
          return
        }
        throw new Error(body.error || 'Could not update passphrase.')
      }

      if (newPassphrase) {
        onPassphraseChanged?.(newPassphrase)
        setPassphraseSuccess('Passphrase set.')
      } else {
        onPassphraseChanged?.(null)
        setPassphraseSuccess('Passphrase removed.')
      }
      setNewPassphrase('')
      setConfirmPassphrase('')
      setTimeout(() => setPassphraseSuccess(null), 2000)
      router.refresh()
    } catch (err) {
      setPassphraseError(err instanceof Error ? err.message : 'Unknown error.')
    } finally {
      setPassphraseBusy(false)
    }
  }

  return (
    <div className="space-y-6">
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

      <form onSubmit={savePassphrase} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div>
          <h3 className="text-sm font-medium text-zinc-700">
            {hasPassphrase ? 'Change or remove passphrase' : 'Set a passphrase'}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {hasPassphrase
              ? 'Enter a new passphrase to change it, or leave empty and save to remove it.'
              : 'When set, editing and deleting expenses, settlements, and members will require this passphrase.'}
          </p>
        </div>

        <div>
          <label htmlFor="new-passphrase" className="block text-xs font-medium text-zinc-500">
            {hasPassphrase ? 'New passphrase' : 'Passphrase'}
          </label>
          <input
            id="new-passphrase"
            type="password"
            value={newPassphrase}
            onChange={(e) => setNewPassphrase(e.target.value)}
            placeholder={hasPassphrase ? 'Leave empty to remove' : 'Enter a passphrase'}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm"
            disabled={passphraseBusy}
            autoComplete="off"
          />
        </div>

        {newPassphrase && (
          <div>
            <label htmlFor="confirm-passphrase" className="block text-xs font-medium text-zinc-500">
              Confirm passphrase
            </label>
            <input
              id="confirm-passphrase"
              type="password"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              placeholder="Confirm"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm"
              disabled={passphraseBusy}
              autoComplete="off"
            />
          </div>
        )}

        {passphraseError && <p className="text-sm text-red-600">{passphraseError}</p>}
        {passphraseSuccess && <p className="text-sm text-green-600">{passphraseSuccess}</p>}

        <button
          type="submit"
          disabled={passphraseBusy || (!newPassphrase && !hasPassphrase)}
          className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {passphraseBusy
            ? 'Saving...'
            : hasPassphrase && !newPassphrase
              ? 'Remove passphrase'
              : hasPassphrase
                ? 'Change passphrase'
                : 'Set passphrase'}
        </button>
      </form>
    </div>
  )
}

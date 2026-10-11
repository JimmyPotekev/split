'use client'

// Manage group members: add new ones, rename existing, remove unused.
// Inline editing keeps things tight. Delete is blocked server-side if the
// member has any expenses or settlements attached, and the error surfaces here.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPassphraseError } from '@/components/PassphrasePrompt'
import { useToast } from '@/components/Toast'

interface Member { id: string; name: string }

export default function MemberManager({
  slug,
  members,
  passphrase,
  hasPassphrase,
  onPassphraseNeeded,
  onPassphraseWrong,
}: {
  slug: string
  members: Member[]
  passphrase?: string | null
  hasPassphrase?: boolean
  onPassphraseNeeded?: (retry?: (passphrase: string) => void) => void
  onPassphraseWrong?: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) return
    setAdding(true)
    try {
      const res = await fetch(`/api/groups/${slug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Could not add member.')
      }
      setNewName('')
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not add member.')
    } finally {
      setAdding(false)
    }
  }

  function startRename(m: Member) {
    setEditingId(m.id)
    setEditName(m.name)
  }

  async function saveRename(id: string, overridePassphrase?: string) {
    const trimmed = editName.trim()
    if (!trimmed) return
    const pp = overridePassphrase ?? passphrase
    if (hasPassphrase && !pp) {
      onPassphraseNeeded?.((provided) => saveRename(id, provided))
      return
    }
    setBusy(id)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (pp) headers['X-Group-Pass'] = pp
    try {
      const res = await fetch(`/api/groups/${slug}/members/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (isPassphraseError(body)) {
          onPassphraseNeeded?.((provided) => saveRename(id, provided))
          onPassphraseWrong?.()
          return
        }
        throw new Error(body.error || 'Could not rename.')
      }
      setEditingId(null)
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not rename member.')
    } finally {
      setBusy(null)
    }
  }

  async function removeMember(m: Member, overridePassphrase?: string) {
    const pp = overridePassphrase ?? passphrase
    if (hasPassphrase && !pp) {
      onPassphraseNeeded?.((provided) => removeMember(m, provided))
      return
    }
    setBusy(m.id)
    const headers: Record<string, string> = {}
    if (pp) headers['X-Group-Pass'] = pp
    try {
      const res = await fetch(`/api/groups/${slug}/members/${m.id}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (isPassphraseError(body)) {
          onPassphraseNeeded?.((provided) => removeMember(m, provided))
          onPassphraseWrong?.()
          return
        }
        throw new Error(body.error || 'Could not remove.')
      }
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not remove member.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <ul className="divide-y divide-zinc-200">
        {members.map((m) => {
          const isEditing = editingId === m.id
          const isBusy = busy === m.id
          return (
            <li key={m.id} className="group flex items-center gap-3 px-4 py-3">
              {isEditing ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); saveRename(m.id) }}
                  className="flex flex-1 items-center gap-2"
                >
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    disabled={isBusy}
                  />
                  <button
                    type="submit"
                    disabled={isBusy || !editName.trim()}
                    className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    disabled={isBusy}
                    className="text-xs text-zinc-500 hover:text-zinc-700"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex-1 font-medium">{m.name}</span>
                  <button
                    onClick={() => startRename(m)}
                    className="text-zinc-400 opacity-0 transition hover:text-zinc-700 group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Rename ${m.name}`}
                    title="Rename"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
                      <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 1 14 9v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeMember(m)}
                    disabled={isBusy}
                    className="text-zinc-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100 disabled:opacity-50 focus:opacity-100"
                    aria-label={`Remove ${m.name}`}
                    title="Remove"
                  >
                    ✕
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>

      <form onSubmit={addMember} className="flex items-center gap-2 border-t border-zinc-200 px-4 py-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New member name"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          disabled={adding}
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {adding ? 'Adding...' : 'Add'}
        </button>
      </form>

    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'

export default function PassphrasePrompt({
  open,
  onSubmit,
  onCancel,
  error,
}: {
  open: boolean
  onSubmit: (passphrase: string) => void
  onCancel: () => void
  error?: string | null
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setValue('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 bg-black/40"
        tabIndex={-1}
      />
      <div className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-zinc-900">Enter group passphrase</h3>
        <p className="mt-1 text-sm text-zinc-500">
          This group requires a passphrase to make changes.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (value.trim()) onSubmit(value)
          }}
          className="mt-4 space-y-3"
        >
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Passphrase"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
            autoComplete="off"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white font-medium hover:bg-zinc-800 disabled:opacity-50"
            >
              Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const STORAGE_PREFIX = 'split-passphrase-'

export function getStoredPassphrase(slug: string): string | null {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + slug)
  } catch {
    return null
  }
}

export function setStoredPassphrase(slug: string, passphrase: string) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + slug, passphrase)
  } catch {
    // private browsing or storage disabled, passphrase only lives in memory
  }
}

export function clearStoredPassphrase(slug: string) {
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + slug)
  } catch {
    // ignore
  }
}

export function isPassphraseError(body: Record<string, unknown>): boolean {
  return body?.code === 'PASSPHRASE_REQUIRED'
}

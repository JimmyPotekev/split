'use client'

// Small reusable confirmation modal. Overlay + centered card, escape to cancel,
// click-outside to cancel, focus trap kept minimal (focus lands on the confirm
// button when it opens). Not building on a headless-ui / radix dependency yet;
// this one modal doesn't justify the weight.

import { useEffect, useRef } from 'react'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const confirmRef = useRef<HTMLButtonElement | null>(null)

  // esc closes, focus lands on the confirm button when it opens
  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* backdrop */}
      <button
        aria-label="Close"
        onClick={() => !busy && onCancel()}
        className="absolute inset-0 bg-black/40"
        tabIndex={-1}
      />
      {/* card */}
      <div className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 id="confirm-title" className="text-base font-semibold text-zinc-900">
          {title}
        </h3>
        <div className="mt-2 text-sm text-zinc-600">{message}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={busy}
            className={
              'rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ' +
              (danger ? 'bg-red-600 hover:bg-red-700' : 'bg-zinc-900 hover:bg-zinc-800')
            }
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

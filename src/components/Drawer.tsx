'use client'

// Slide-out drawer from the right. Same interaction model as ConfirmDialog
// (escape, backdrop, focus management) but as a side panel instead of a
// centered card. Always mounted so we can animate the slide without
// mount/unmount complexity.

import { useEffect, useRef } from 'react'

export default function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <div
      role="dialog"
      aria-modal={open}
      aria-labelledby="drawer-title"
      className={
        'fixed inset-0 z-50 transition-visibility ' +
        (open ? 'visible' : 'invisible pointer-events-none')
      }
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className={
          'absolute inset-0 bg-black/40 transition-opacity duration-300 ' +
          (open ? 'opacity-100' : 'opacity-0')
        }
        tabIndex={-1}
      />

      <div
        className={
          'absolute top-0 right-0 bottom-0 flex w-full flex-col bg-white shadow-xl ' +
          'transition-transform duration-300 ease-out ' +
          'sm:max-w-md sm:rounded-l-xl ' +
          (open ? 'translate-x-0' : 'translate-x-full')
        }
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h2 id="drawer-title" className="text-lg font-semibold text-zinc-900">
            {title}
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:text-zinc-700"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

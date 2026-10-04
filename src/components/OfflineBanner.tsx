'use client'

// fixed banner at the bottom of the viewport. shows when offline or when
// queued mutations are being replayed after reconnecting.

import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export default function OfflineBanner({
  pendingCount,
  replaying,
}: {
  pendingCount: number
  replaying: boolean
}) {
  const online = useOnlineStatus()

  if (online && pendingCount === 0) return null

  let message = ''
  if (!online && pendingCount === 0) {
    message = 'You are offline'
  } else if (!online && pendingCount > 0) {
    message = `Offline. ${pendingCount} change${pendingCount !== 1 ? 's' : ''} queued.`
  } else if (online && replaying) {
    message = 'Syncing queued changes…'
  } else if (online && pendingCount > 0) {
    message = `Syncing ${pendingCount} queued change${pendingCount !== 1 ? 's' : ''}…`
  }

  return (
    <div
      className={
        'fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg transition-colors ' +
        (online ? 'bg-sky-600 text-white' : 'bg-amber-500 text-white')
      }
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-2">
        {!online && (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728" />
            <line x1="4" y1="4" x2="20" y2="20" strokeLinecap="round" />
          </svg>
        )}
        {online && replaying && (
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {message}
      </span>
    </div>
  )
}

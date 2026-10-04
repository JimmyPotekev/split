// offline queue. stores pending mutations in IndexedDB when the network is
// unavailable and replays them when connectivity comes back. works with the
// existing optimistic UI so queued items stay visible while offline.

const DB_NAME = 'split-offline'
const DB_VERSION = 1
const STORE_NAME = 'pending-mutations'

export interface QueuedMutation {
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body: string
  createdAt: number
  type: 'expense' | 'settlement'
  description: string
  groupSlug: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function addToQueue(mutation: QueuedMutation): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(mutation)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function getQueue(groupSlug?: string): Promise<QueuedMutation[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => {
      db.close()
      let items = req.result as QueuedMutation[]
      if (groupSlug) items = items.filter(m => m.groupSlug === groupSlug)
      items.sort((a, b) => a.createdAt - b.createdAt)
      resolve(items)
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false
  const msg = (err.message || '').toLowerCase()
  return msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed')
}

// wraps fetch. if the request fails because we're offline, queues it in
// IndexedDB and returns 'queued' so the caller can keep the optimistic state
// instead of reverting.
export async function fetchOrQueue(
  input: { url: string; method: string; headers: Record<string, string>; body: string },
  meta: { type: 'expense' | 'settlement'; description: string; groupSlug: string },
): Promise<Response | 'queued'> {
  try {
    const res = await fetch(input.url, {
      method: input.method,
      headers: input.headers,
      body: input.body,
    })
    return res
  } catch (err) {
    if (isNetworkError(err)) {
      await addToQueue({
        id: `queue-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...input,
        ...meta,
        createdAt: Date.now(),
      })
      return 'queued'
    }
    throw err
  }
}

// replays all queued mutations for a group in order. stops if we go back
// offline mid-replay. calls onEach after each attempt so the caller can
// update UI (count, error toasts, etc).
export async function replayQueue(
  groupSlug: string,
  onEach: (mutation: QueuedMutation, result: 'success' | 'error', error?: string) => void,
): Promise<void> {
  const items = await getQueue(groupSlug)
  for (const mutation of items) {
    if (!navigator.onLine) break
    try {
      const res = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers,
        body: mutation.body,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        await removeFromQueue(mutation.id)
        onEach(mutation, 'error', body.error || `Server returned ${res.status}`)
        continue
      }
      await removeFromQueue(mutation.id)
      onEach(mutation, 'success')
    } catch (err) {
      if (isNetworkError(err)) break
      await removeFromQueue(mutation.id)
      onEach(mutation, 'error', err instanceof Error ? err.message : 'Unknown error')
    }
  }
}

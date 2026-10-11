'use client'

// Group page shell. Holds optimistic local state for expenses and settlements
// so mutations feel instant. Children call the optimistic callbacks, do their
// own fetch, then confirm or revert. router.refresh() still syncs server truth,
// but the UI doesn't wait for it.
//
// Also manages the offline queue: when mutations fail because the network is
// down, they land in IndexedDB. When connectivity returns, this component
// replays them in order and refreshes.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ExpenseForm from './ExpenseForm'
import ExpenseList from './ExpenseList'
import BalancePanel from './BalancePanel'
import SettleUp from './SettleUp'
import MemberManager from './MemberManager'
import GroupSettings from './GroupSettings'
import Drawer from '@/components/Drawer'
import { ToastProvider } from '@/components/Toast'
import OfflineBanner from '@/components/OfflineBanner'
import PassphrasePrompt, {
  getStoredPassphrase,
  setStoredPassphrase,
  clearStoredPassphrase,
} from '@/components/PassphrasePrompt'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getQueue, replayQueue } from '@/lib/offline-queue'

interface Member { id: string; name: string }
interface Share { memberId: string; amount: number }
interface Expense {
  id: string
  description: string
  amount: number
  date: string | Date
  payerId: string
  splitType?: string
  shares: Share[]
}
interface Settlement {
  id: string
  fromId: string
  toId: string
  amount: number
  date: string | Date
  note?: string | null
}
interface Group {
  slug: string
  name: string
  currency: string
  hasPassphrase: boolean
  members: Member[]
  expenses: Expense[]
  settlements: Settlement[]
}

export type OptimisticResult = { confirm: () => void; revert: () => void }

export default function GroupView({ group }: { group: Group }) {
  const router = useRouter()
  const online = useOnlineStatus()
  const [copied, setCopied] = useState(false)
  const [openDrawer, setOpenDrawer] = useState<'members' | 'settle' | 'settings' | null>(null)
  const [passphrase, setPassphrase] = useState<string | null>(null)
  const [passphrasePromptOpen, setPassphrasePromptOpen] = useState(false)
  const [passphraseError, setPassphraseError] = useState<string | null>(null)

  // -- offline queue state --
  const [pendingCount, setPendingCount] = useState(0)
  const [replaying, setReplaying] = useState(false)
  const replayingRef = useRef(false)

  useEffect(() => {
    if (group.hasPassphrase) {
      const stored = getStoredPassphrase(group.slug)
      if (stored) setPassphrase(stored)
    }
  }, [group.slug, group.hasPassphrase])

  // check queue size on mount and whenever group changes
  useEffect(() => {
    getQueue(group.slug).then(items => setPendingCount(items.length)).catch(() => {})
  }, [group.slug])

  // replay queue when we come back online
  useEffect(() => {
    if (!online || replayingRef.current) return

    let cancelled = false
    async function replay() {
      const items = await getQueue(group.slug).catch(() => [])
      if (items.length === 0 || cancelled) return

      replayingRef.current = true
      setReplaying(true)
      setPendingCount(items.length)

      await replayQueue(group.slug, (_mutation, _result) => {
        if (cancelled) return
        setPendingCount(prev => Math.max(0, prev - 1))
      })

      if (!cancelled) {
        replayingRef.current = false
        setReplaying(false)
        // clear optimistic state so the server refresh doesn't duplicate entries
        pendingAddIdsRef.current.clear()
        pendingDeleteIdsRef.current.clear()
        const remaining = await getQueue(group.slug).catch(() => [])
        setPendingCount(remaining.length)
        router.refresh()
      }
    }

    replay()
    return () => { cancelled = true }
  }, [online, group.slug, router])

  const handleQueued = useCallback(() => {
    setPendingCount(prev => prev + 1)
  }, [])

  // -- optimistic local state --
  const [localExpenses, setLocalExpenses] = useState(group.expenses)
  const [localSettlements, setLocalSettlements] = useState(group.settlements)
  const prevGroupRef = useRef(group)
  const pendingAddIdsRef = useRef<Set<string>>(new Set())
  const pendingDeleteIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (group !== prevGroupRef.current) {
      prevGroupRef.current = group
      setLocalExpenses(prev => {
        const pendingAdds = prev.filter(e => pendingAddIdsRef.current.has(e.id))
        const serverMinusDeleted = group.expenses.filter(
          e => !pendingDeleteIdsRef.current.has(e.id)
        )
        return [...pendingAdds, ...serverMinusDeleted]
      })
      setLocalSettlements(prev => {
        const pendingAdds = prev.filter(s => pendingAddIdsRef.current.has(s.id))
        const serverMinusDeleted = group.settlements.filter(
          s => !pendingDeleteIdsRef.current.has(s.id)
        )
        return [...pendingAdds, ...serverMinusDeleted]
      })
    }
  }, [group])

  const addExpenseOptimistic = useCallback((expense: Expense): OptimisticResult => {
    pendingAddIdsRef.current.add(expense.id)
    setLocalExpenses(prev => [expense, ...prev])
    return {
      confirm: () => { pendingAddIdsRef.current.delete(expense.id) },
      revert: () => {
        pendingAddIdsRef.current.delete(expense.id)
        setLocalExpenses(prev => prev.filter(e => e.id !== expense.id))
      },
    }
  }, [])

  const removeExpenseOptimistic = useCallback((id: string): OptimisticResult => {
    let removed: Expense | undefined
    pendingDeleteIdsRef.current.add(id)
    setLocalExpenses(prev => {
      removed = prev.find(e => e.id === id)
      return prev.filter(e => e.id !== id)
    })
    return {
      confirm: () => { pendingDeleteIdsRef.current.delete(id) },
      revert: () => {
        pendingDeleteIdsRef.current.delete(id)
        if (removed) setLocalExpenses(prev => [...prev, removed!])
      },
    }
  }, [])

  const addSettlementOptimistic = useCallback((settlement: Settlement): OptimisticResult => {
    pendingAddIdsRef.current.add(settlement.id)
    setLocalSettlements(prev => [settlement, ...prev])
    return {
      confirm: () => { pendingAddIdsRef.current.delete(settlement.id) },
      revert: () => {
        pendingAddIdsRef.current.delete(settlement.id)
        setLocalSettlements(prev => prev.filter(s => s.id !== settlement.id))
      },
    }
  }, [])

  const removeSettlementOptimistic = useCallback((id: string): OptimisticResult => {
    let removed: Settlement | undefined
    pendingDeleteIdsRef.current.add(id)
    setLocalSettlements(prev => {
      removed = prev.find(s => s.id === id)
      return prev.filter(s => s.id !== id)
    })
    return {
      confirm: () => { pendingDeleteIdsRef.current.delete(id) },
      revert: () => {
        pendingDeleteIdsRef.current.delete(id)
        if (removed) setLocalSettlements(prev => [...prev, removed!])
      },
    }
  }, [])

  const pendingRetryRef = useRef<((passphrase: string) => void) | null>(null)

  const handlePassphraseNeeded = useCallback((retry?: (passphrase: string) => void) => {
    pendingRetryRef.current = retry ?? null
    setPassphraseError(null)
    setPassphrasePromptOpen(true)
  }, [])

  function handlePassphraseSubmit(value: string) {
    setPassphrase(value)
    setStoredPassphrase(group.slug, value)
    setPassphrasePromptOpen(false)
    setPassphraseError(null)
    const retry = pendingRetryRef.current
    pendingRetryRef.current = null
    if (retry) retry(value)
  }

  function handlePassphraseWrong() {
    clearStoredPassphrase(group.slug)
    setPassphrase(null)
    setPassphraseError('Wrong passphrase. Try again.')
    setPassphrasePromptOpen(true)
  }

  async function copyLink() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  const btnClass =
    'rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50'

  return (
    <ToastProvider>
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{group.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {group.members.length} people · {group.currency}
            {group.hasPassphrase && ' · passphrase protected'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setOpenDrawer('members')} className={btnClass}>
            Members
          </button>
          <button onClick={() => setOpenDrawer('settle')} className={btnClass}>
            Settle up
          </button>
          <button onClick={() => setOpenDrawer('settings')} className={btnClass}>
            Settings
          </button>
          <button onClick={copyLink} className={btnClass}>
            {copied ? 'Copied!' : 'Share link'}
          </button>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Add expense</h2>
          <div className="mt-3">
            <ExpenseForm
              slug={group.slug}
              members={group.members}
              currency={group.currency}
              onOptimisticAdd={addExpenseOptimistic}
              onQueued={handleQueued}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Balances</h2>
          <div className="mt-3">
            <BalancePanel
              members={group.members}
              expenses={localExpenses}
              settlements={localSettlements}
              currency={group.currency}
            />
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">History</h2>
        <div className="mt-3">
          <ExpenseList
            slug={group.slug}
            expenses={localExpenses}
            settlements={localSettlements}
            members={group.members}
            currency={group.currency}
            passphrase={passphrase}
            hasPassphrase={group.hasPassphrase}
            onPassphraseNeeded={handlePassphraseNeeded}
            onPassphraseWrong={handlePassphraseWrong}
            onOptimisticRemoveExpense={removeExpenseOptimistic}
            onOptimisticRemoveSettlement={removeSettlementOptimistic}
          />
        </div>
      </section>

      <Drawer
        open={openDrawer === 'members'}
        onClose={() => setOpenDrawer(null)}
        title="Members"
      >
        <MemberManager
          slug={group.slug}
          members={group.members}
          passphrase={passphrase}
          hasPassphrase={group.hasPassphrase}
          onPassphraseNeeded={handlePassphraseNeeded}
          onPassphraseWrong={handlePassphraseWrong}
        />
      </Drawer>

      <Drawer
        open={openDrawer === 'settings'}
        onClose={() => setOpenDrawer(null)}
        title="Group settings"
      >
        <GroupSettings
          slug={group.slug}
          name={group.name}
          currency={group.currency}
          hasActivity={group.expenses.length > 0 || group.settlements.length > 0}
          passphrase={passphrase}
          hasPassphrase={group.hasPassphrase}
          onPassphraseNeeded={handlePassphraseNeeded}
          onPassphraseWrong={handlePassphraseWrong}
          onPassphraseChanged={(newPass) => {
            if (newPass) {
              setPassphrase(newPass)
              setStoredPassphrase(group.slug, newPass)
            } else {
              setPassphrase(null)
              clearStoredPassphrase(group.slug)
            }
          }}
        />
      </Drawer>

      <Drawer
        open={openDrawer === 'settle'}
        onClose={() => setOpenDrawer(null)}
        title="Settle up"
      >
        <SettleUp
          slug={group.slug}
          members={group.members}
          expenses={localExpenses}
          settlements={localSettlements}
          currency={group.currency}
          onOptimisticAdd={addSettlementOptimistic}
          onQueued={handleQueued}
        />
      </Drawer>

      <PassphrasePrompt
        open={passphrasePromptOpen}
        onSubmit={handlePassphraseSubmit}
        onCancel={() => setPassphrasePromptOpen(false)}
        error={passphraseError}
      />

      <OfflineBanner pendingCount={pendingCount} replaying={replaying} />
    </main>
    </ToastProvider>
  )
}

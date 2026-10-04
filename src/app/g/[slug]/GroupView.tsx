'use client'

// Group page shell. Layout:
//  header (with drawer triggers) -> expense form + balances (side by side on
//  desktop) -> history. Members and settle-up live in slide-out drawers so they
//  don't eat vertical space on the main page.

import { useState, useEffect, useCallback } from 'react'
import ExpenseForm from './ExpenseForm'
import ExpenseList from './ExpenseList'
import BalancePanel from './BalancePanel'
import SettleUp from './SettleUp'
import MemberManager from './MemberManager'
import GroupSettings from './GroupSettings'
import Drawer from '@/components/Drawer'
import PassphrasePrompt, {
  getStoredPassphrase,
  setStoredPassphrase,
  clearStoredPassphrase,
} from '@/components/PassphrasePrompt'

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

export default function GroupView({ group }: { group: Group }) {
  const [copied, setCopied] = useState(false)
  const [openDrawer, setOpenDrawer] = useState<'members' | 'settle' | 'settings' | null>(null)
  const [passphrase, setPassphrase] = useState<string | null>(null)
  const [passphrasePromptOpen, setPassphrasePromptOpen] = useState(false)
  const [passphraseError, setPassphraseError] = useState<string | null>(null)

  useEffect(() => {
    if (group.hasPassphrase) {
      const stored = getStoredPassphrase(group.slug)
      if (stored) setPassphrase(stored)
    }
  }, [group.slug, group.hasPassphrase])

  const handlePassphraseNeeded = useCallback(() => {
    setPassphraseError(null)
    setPassphrasePromptOpen(true)
  }, [])

  function handlePassphraseSubmit(value: string) {
    setPassphrase(value)
    setStoredPassphrase(group.slug, value)
    setPassphrasePromptOpen(false)
    setPassphraseError(null)
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
            <ExpenseForm slug={group.slug} members={group.members} currency={group.currency} />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Balances</h2>
          <div className="mt-3">
            <BalancePanel
              members={group.members}
              expenses={group.expenses}
              settlements={group.settlements}
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
            expenses={group.expenses}
            settlements={group.settlements}
            members={group.members}
            currency={group.currency}
            passphrase={passphrase}
            hasPassphrase={group.hasPassphrase}
            onPassphraseNeeded={handlePassphraseNeeded}
            onPassphraseWrong={handlePassphraseWrong}
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
          expenses={group.expenses}
          settlements={group.settlements}
          currency={group.currency}
        />
      </Drawer>

      <PassphrasePrompt
        open={passphrasePromptOpen}
        onSubmit={handlePassphraseSubmit}
        onCancel={() => setPassphrasePromptOpen(false)}
        error={passphraseError}
      />
    </main>
  )
}

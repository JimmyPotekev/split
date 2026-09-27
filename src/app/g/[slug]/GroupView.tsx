'use client'

// Group page shell. Order top-to-bottom:
//  header -> balances -> settle-up suggestions -> history -> add-expense form
// Reasoning: balances answer "what's my status", settle-up answers "what do I
// do next", history is reference, and the form is the input at the bottom.

import { useState } from 'react'
import ExpenseForm from './ExpenseForm'
import ExpenseList from './ExpenseList'
import BalancePanel from './BalancePanel'
import SettleUp from './SettleUp'

interface Member { id: string; name: string }
interface Share { memberId: string; amount: number }
interface Expense {
  id: string
  description: string
  amount: number
  date: string | Date
  payerId: string
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
  members: Member[]
  expenses: Expense[]
  settlements: Settlement[]
}

export default function GroupView({ group }: { group: Group }) {
  const [copied, setCopied] = useState(false)

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

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{group.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {group.members.length} people · {group.currency}
          </p>
        </div>
        <button
          onClick={copyLink}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          {copied ? 'Copied!' : 'Share link'}
        </button>
      </header>

      <section className="mt-8">
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

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Settle up</h2>
        <div className="mt-3">
          <SettleUp
            slug={group.slug}
            members={group.members}
            expenses={group.expenses}
            settlements={group.settlements}
            currency={group.currency}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">History</h2>
        <div className="mt-3">
          <ExpenseList
            slug={group.slug}
            expenses={group.expenses}
            settlements={group.settlements}
            members={group.members}
            currency={group.currency}
          />
        </div>
      </section>

      <section className="mt-6">
        <ExpenseForm slug={group.slug} members={group.members} currency={group.currency} />
      </section>
    </main>
  )
}

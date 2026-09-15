'use client'

// Client shell for the group page. Right now it just shows the header,
// members, and a share button. Phase 3 wires in the add-expense form,
// phase 4 the balance panel, phase 5 the settle-up view.
// Keeping this as one component for now; will split when it grows.

import { useState } from 'react'

interface Member { id: string; name: string }
interface Group {
  slug: string
  name: string
  currency: string
  members: Member[]
  expenses: unknown[]
  settlements: unknown[]
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
      // clipboard blocked (older browser, iframe). Fall back to selecting.
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">People</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {group.members.map((m) => (
            <li
              key={m.id}
              className="rounded-full bg-white border border-zinc-200 px-3 py-1 text-sm"
            >
              {m.name}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Expenses</h2>
        <p className="mt-2 text-sm text-zinc-500">
          No expenses yet. Add-expense form ships in the next update.
        </p>
      </section>
    </main>
  )
}

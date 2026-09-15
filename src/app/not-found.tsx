import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Group not found</h1>
      <p className="mt-2 text-zinc-600">
        The link might be wrong, or the group was deleted.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-white font-medium hover:bg-zinc-800"
      >
        Create a new group
      </Link>
    </main>
  )
}

// Skeleton loader shown while the server component fetches group data.
// Mirrors the GroupView layout so the page doesn't jump when content loads.

function Bone({ className }: { className?: string }) {
  return <div className={'animate-pulse rounded bg-zinc-200 ' + (className ?? '')} />
}

export default function GroupLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Bone className="h-8 w-48" />
          <Bone className="mt-2 h-4 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Bone className="h-10 w-20" />
          <Bone className="h-10 w-20" />
          <Bone className="h-10 w-20" />
          <Bone className="h-10 w-24" />
        </div>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <section>
          <Bone className="h-4 w-24" />
          <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <Bone className="h-10 w-full" />
              <Bone className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Bone className="h-16 w-full" />
              <Bone className="h-16 w-full" />
            </div>
            <Bone className="h-10 w-full" />
          </div>
        </section>

        <section>
          <Bone className="h-4 w-20" />
          <div className="mt-3 rounded-lg border border-zinc-200 bg-white shadow-sm divide-y divide-zinc-200">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <Bone className="h-5 w-24" />
                <Bone className="h-5 w-16" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <Bone className="h-4 w-16" />
        <div className="mt-3 rounded-lg border border-zinc-200 bg-white shadow-sm divide-y divide-zinc-200">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex-1">
                <Bone className="h-5 w-40" />
                <Bone className="mt-1 h-3 w-56" />
              </div>
              <Bone className="h-5 w-16" />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

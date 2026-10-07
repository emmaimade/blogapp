/**
 * Full-page placeholder for the admin while the startup session check runs
 * (a refresh, or opening an admin link). It's shaped like the admin layout —
 * sidebar, top bar, content — so it hands over to the page's own skeleton as
 * one continuous load instead of a blank screen with a spinner.
 *
 * Invisible for the first ~300ms: a quick check (the usual case) goes straight
 * to the page without flashing this at all.
 */
export const AdminShellSkeleton = () => (
  <div
    role="status"
    className="min-h-screen bg-[var(--admin-bg)] opacity-0 [animation:admin-fade-in_0.2s_ease-out_0.3s_forwards]"
  >
    <span className="sr-only">Loading</span>

    {/* Mobile top bar */}
    <div className="fixed inset-x-0 top-0 z-10 flex h-14 items-center border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 lg:hidden">
      <div className="h-5 w-28 rounded-md bg-zinc-200 dark:bg-zinc-800" />
    </div>

    {/* Desktop sidebar */}
    <div className="fixed inset-y-0 left-0 hidden w-[var(--sidebar-width,248px)] border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 lg:block">
      <div className="h-8 w-32 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-8 space-y-2">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    </div>

    <div className="pt-14 lg:pt-0 lg:pl-[var(--sidebar-width,248px)]">
      {/* Desktop top bar */}
      <div className="hidden h-[57px] border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:block" />

      <div className="mx-auto max-w-6xl animate-pulse space-y-6 px-5 pt-6">
        <div className="h-8 w-64 max-w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="admin-card h-28" />
          ))}
        </div>
        <div className="admin-card h-64" />
      </div>
    </div>
  </div>
);

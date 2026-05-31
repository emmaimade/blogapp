export const SuperAdminDashboardSkeleton = () => {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded-lg w-1/3 mb-4 animate-pulse" />
        <div className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded-lg w-1/2 animate-pulse" />
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 animate-pulse"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="h-6 w-6 bg-zinc-200 dark:bg-zinc-700 rounded" />
              <div className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded w-24" />
            </div>
            <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded-lg w-20 mb-2" />
            <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-32" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded w-32 animate-pulse" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="px-6 py-4">
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-24 animate-pulse" />
                </th>
                <th className="px-6 py-4">
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-20 animate-pulse" />
                </th>
                <th className="px-6 py-4">
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-20 animate-pulse" />
                </th>
                <th className="px-6 py-4">
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-16 animate-pulse" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-6 py-4">
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-40 animate-pulse" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-12 animate-pulse" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-12 animate-pulse" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded-full w-16 animate-pulse" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

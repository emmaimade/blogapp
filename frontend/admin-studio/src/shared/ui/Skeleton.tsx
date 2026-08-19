interface SkeletonProps {
  className?: string;
}

export const SkeletonBar = ({ className = 'h-4 w-24' }: SkeletonProps) => (
  <div className={`animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800 ${className}`} />
);

export const SkeletonCircle = ({ className = 'h-9 w-9' }: SkeletonProps) => (
  <div className={`animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800 ${className}`} />
);

interface SkeletonStatCardProps {
  className?: string;
}

export const SkeletonStatCard = ({ className = '' }: SkeletonStatCardProps) => (
  <div className={`rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
    <SkeletonBar className="h-3 w-20 mb-3" />
    <SkeletonBar className="h-7 w-16" />
  </div>
);

interface TableRowSkeletonProps {
  columns: number;
  rows?: number;
  cellClassName?: string;
}

export const TableRowSkeleton = ({ columns, rows = 5, cellClassName = 'px-6 py-4' }: TableRowSkeletonProps) => (
  <>
    {[...Array(rows)].map((_, i) => (
      <tr key={i}>
        {[...Array(columns)].map((_, j) => (
          <td key={j} className={cellClassName}>
            <SkeletonBar />
          </td>
        ))}
      </tr>
    ))}
  </>
);

interface SkeletonListRowProps {
  className?: string;
  withAvatar?: boolean;
}

export const SkeletonListRow = ({ className = '', withAvatar = true }: SkeletonListRowProps) => (
  <div className={`flex items-center gap-3 px-4 py-4 ${className}`}>
    {withAvatar && <SkeletonCircle className="h-8 w-8 shrink-0" />}
    <div className="flex-1 space-y-2 min-w-0">
      <SkeletonBar className="h-3.5 w-1/3" />
      <SkeletonBar className="h-3 w-1/4" />
    </div>
  </div>
);

interface ActivityFeedSkeletonProps {
  rows?: number;
  className?: string;
}

export const ActivityFeedSkeleton = ({ rows = 6, className = '' }: ActivityFeedSkeletonProps) => (
  <div className={`divide-y divide-zinc-100 dark:divide-zinc-900 ${className}`}>
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="flex items-start gap-3 p-4">
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex-1 min-w-0 space-y-2">
          <SkeletonBar className="h-3.5 w-1/3" />
          <SkeletonBar className="h-3 w-2/3" />
        </div>
        <SkeletonBar className="h-3 w-12 shrink-0" />
      </div>
    ))}
  </div>
);

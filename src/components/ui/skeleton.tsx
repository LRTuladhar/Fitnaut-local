export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-secondary ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="px-5 pt-12 pb-8 space-y-4">
      <Skeleton className="h-8 w-36 rounded-lg" />
      <Skeleton className="h-10 rounded-xl" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

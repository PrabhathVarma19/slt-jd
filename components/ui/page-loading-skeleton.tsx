export function PageLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-live="polite" aria-busy="true">
      <div className="h-8 w-64 rounded bg-gray-200" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 rounded-lg bg-gray-200" />
        <div className="h-40 rounded-lg bg-gray-200" />
      </div>
      <div className="h-64 rounded-lg bg-gray-200" />
    </div>
  );
}

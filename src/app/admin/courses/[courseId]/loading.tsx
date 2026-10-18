/** Skeleton while the course editor loads. */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading course editor">
      <div className="mb-2 h-4 w-24 rounded bg-line" />
      <div className="mb-3 h-8 w-2/3 rounded bg-line" />
      <div className="mb-8 h-4 w-1/3 rounded bg-line" />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="card h-96" />
        <div className="card h-64" />
      </div>
      <div className="mt-10 mb-4 h-6 w-40 rounded bg-line" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="card mb-3 flex gap-4 p-4">
          <div className="size-9 rounded-full bg-line" />
          <div className="aspect-video w-40 rounded-lg bg-line" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 rounded bg-line" />
            <div className="h-3 w-3/4 rounded bg-line" />
          </div>
        </div>
      ))}
    </div>
  );
}

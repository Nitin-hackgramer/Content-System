import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading">
      <div className="mb-6 flex items-start gap-3"><Skeleton className="size-11 shrink-0 !rounded-full" /><div className="flex-1"><Skeleton className="h-9 w-3/4" /></div><Skeleton className="size-11 !rounded-full" /></div>
      <Skeleton className="h-[11rem] !rounded-card-lg" />
      <Skeleton className="mt-3 h-[4.25rem] !rounded-card-lg" />
      <Skeleton className="mb-3 mt-9 h-6 w-2/5" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[3/4] !rounded-card-lg" />)}</div>
    </div>
  );
}

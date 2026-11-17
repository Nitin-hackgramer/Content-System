import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading">
      <div className="mb-6 flex items-start gap-3"><div className="flex-1"><Skeleton className="h-9 w-1/2" /><Skeleton className="mt-3 h-5 w-4/5" /></div><Skeleton className="size-11 !rounded-full" /></div>
      <Skeleton className="h-[5.25rem] !rounded-card-lg" />
      <Skeleton className="mb-3 mt-9 h-6 w-2/5" />
      <div className="space-y-2.5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[5.25rem] !rounded-card-lg" />)}</div>
    </div>
  );
}

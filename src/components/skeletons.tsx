import { Skeleton } from "./ui";

// Loading shapes that mirror the real pages (same heights, radii and gaps), so content replaces them without a layout jump.
const Frame = ({ children }: { children: React.ReactNode }) => <div role="status" aria-label="Loading">{children}</div>;
const Title = () => <Skeleton className="mb-3 h-6 w-2/5" />;
const Shelf = ({ n = 2 }: { n?: number }) => (
  <div className="flex gap-3 overflow-hidden">
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="w-[72%] max-w-[280px] shrink-0">
        <Skeleton className="aspect-[4/3] !rounded-card" /><Skeleton className="mt-3.5 h-[2.8125rem]" /><Skeleton className="mt-2 h-4 w-3/4" />
      </div>
    ))}
  </div>
);
const Header = ({ back }: { back?: boolean }) => (
  <div className="mb-6 flex items-start gap-3">{back && <Skeleton className="size-11 shrink-0 !rounded-full" />}<div className="flex-1"><Skeleton className="h-9 w-1/2" /><Skeleton className="mt-3 h-5 w-4/5" /></div></div>
);
const Row = () => <Skeleton className="h-[5.5rem] !rounded-card-lg" />;

export const DashboardSkeleton = () => (
  <Frame>
    <Skeleton className="h-[4.25rem] w-4/5" />
    <Skeleton className="mt-5 h-14 !rounded-full" />
    <Skeleton className="mt-5 min-h-[27rem] !rounded-card-lg" />
    <Skeleton className="mt-4 h-[7.25rem] !rounded-card-lg" />
    <div className="mt-4 grid grid-cols-4 gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="flex flex-col items-center gap-2 py-3"><Skeleton className="size-14 !rounded-card" /><Skeleton className="h-4 w-12" /></div>)}</div>
    <div className="mt-9"><Title /><Shelf /></div>
  </Frame>
);
export const LibrarySkeleton = () => (
  <Frame>
    <div className="flex gap-2"><Skeleton className="h-14 flex-1 !rounded-full" /><Skeleton className="size-14 !rounded-full" /></div>
    <div className="mt-3 flex gap-2 overflow-hidden">{[56, 96, 84, 88].map((w) => <div key={w} style={{ width: w }} className="shrink-0"><Skeleton className="h-11 !rounded-full" /></div>)}</div>
    <Skeleton className="mb-3 mt-4 h-5 w-1/3" />
    <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-[22rem] !rounded-card-lg md:col-span-2" /><Skeleton className="h-[11.5rem] !rounded-card-lg" /><Skeleton className="h-[11.5rem] !rounded-card-lg" /></div>
  </Frame>
);
export const DetailSkeleton = () => (
  <Frame>
    <Skeleton className="-mx-4 -mt-5 h-56 !rounded-none sm:-mx-6" />
    <Skeleton className="mt-6 h-7 w-24 !rounded-full" /><Skeleton className="mt-3 h-24" /><Skeleton className="mt-3 h-4 w-1/3" />
    <Skeleton className="mt-5 h-36 !rounded-card-lg" /><Skeleton className="mt-4 h-24 !rounded-card-lg" /><Skeleton className="mt-4 h-64 !rounded-card-lg" />
  </Frame>
);
export const DiscoverSkeleton = () => (
  <Frame>
    <Header />
    <Skeleton className="h-44 !rounded-card-lg" /><Skeleton className="mt-4 h-32 !rounded-card-lg" />
    <div className="mt-9"><Title /><Shelf /></div>
  </Frame>
);
export const TrendsSkeleton = () => (
  <Frame>
    <Header back />
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[68px] !rounded-card" />)}</div>
    <div className="mt-9"><Title /><div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-64 !rounded-card-lg" /><Skeleton className="h-64 !rounded-card-lg" /></div></div>
  </Frame>
);
export const ListSkeleton = ({ back }: { back?: boolean }) => (
  <Frame><Header back={back} /><div className="space-y-3">{[0, 1, 2, 3].map((i) => <Row key={i} />)}</div></Frame>
);

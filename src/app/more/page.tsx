import Link from "next/link";
import { TrendUp, ClockCounterClockwise, Broadcast, GearSix, ImagesSquare, FilmSlate, PaperPlaneTilt, CaretRight, Lock } from "@phosphor-icons/react/dist/ssr";
import { loadCore } from "@/lib/load";
import { parseSources } from "@/lib/sources";
import { listJobs } from "@/lib/assets";
import { groupOf } from "@/lib/asset-status";
import { Badge, PageHeader, Section } from "@/components/ui";

const SOON = [
  { label: "Production Studio", body: "Turn a brief into a finished video", Icon: FilmSlate },
  { label: "Publishing Studio", body: "Schedule and post", Icon: PaperPlaneTilt },
];

export default async function More() {
  const d = await loadCore();
  const rows = d.latestRun ? parseSources(d.latestRun.sources) : [];
  const bad = rows.filter((r) => !r.ok).length;
  const topics = new Set(d.ideas.map((i) => i.trend?.topic_key).filter(Boolean)).size;
  const jobs = d.source === "supabase" ? await listJobs().catch(() => null) : null;
  const active = jobs?.filter((j) => groupOf(j.status) !== "history").length ?? 0;
  const tiles = [
    { href: "/trends", label: "Trends", body: "What is new, rising or popular", stat: `${topics} topics`, Icon: TrendUp, tint: "bg-accent-deep text-white" },
    { href: "/history", label: "History", body: "Runs, outcomes and errors", stat: d.runs.length ? `${d.runs.length} runs` : "No logs", Icon: ClockCounterClockwise, tint: "card-obsidian text-bg" },
    { href: "/sources", label: "Sources", body: "Health of every feed", stat: rows.length ? (bad ? `${bad} failing` : `${rows.length} healthy`) : "No data", Icon: Broadcast, tint: "bg-info-200/70 text-info-700" },
    { href: "/settings", label: "Settings", body: "Connections and configuration", stat: d.source === "supabase" ? "Connected" : "Offline", Icon: GearSix, tint: "bg-linen-deep text-ink" },
  ];
  return (
    <>
      <PageHeader title="More" lead="Behind the scenes, and what is next." />
      <Link href="/assets" data-origin className="press-card group mb-3 flex items-center gap-4 rounded-card-lg bg-[image:var(--terracotta-tint)] p-4 ring-1 ring-inset ring-[var(--terracotta-line)]">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-deep text-white"><ImagesSquare size={26} weight="fill" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="t-heading">Asset Studio</p>
          <p className="t-meta mt-0.5">Choose visuals for an idea and send them to your laptop</p>
        </div>
        <p className="flex items-center gap-1 font-mono text-[13px] text-ink">{jobs ? (active ? `${active} active` : `${jobs.length} projects`) : ""}<CaretRight size={16} className="text-muted transition-transform duration-200 group-active:translate-x-1" aria-hidden /></p>
      </Link>
      <ul className="grid grid-cols-2 gap-3">
        {tiles.map(({ href, label, body, stat, Icon, tint }) => (
          <li key={href}>
            <Link href={href} data-origin className="press-card group relative flex h-full min-h-44 flex-col rounded-card-lg bg-paper p-4 shadow-[var(--shadow-e2)]">
              <span className={`grid size-10 place-items-center rounded-xl ${tint}`}><Icon size={26} weight="fill" aria-hidden /></span>
              <p className="t-heading mt-4">{label}</p>
              <p className="t-meta mt-1 flex-1">{body}</p>
              <p className="mt-3 flex items-center justify-between font-mono text-[13px] text-ink">{stat}<CaretRight size={16} className="text-muted transition-transform duration-200 group-active:translate-x-1" aria-hidden /></p>
            </Link>
          </li>
        ))}
      </ul>

      <Section title="Coming later">
        <ul className="space-y-2">
          {SOON.map(({ label, body, Icon }) => (
            <li key={label} className="flex items-center gap-3 rounded-card-lg border border-dashed border-ink/20 p-3.5">
              <span className="grid size-11 place-items-center rounded-card bg-paper text-muted"><Icon size={22} aria-hidden /></span>
              <div className="min-w-0 flex-1"><p className="text-[16px] font-medium">{label}</p><p className="t-meta">{body}</p></div>
              <Badge icon={<Lock size={13} weight="bold" aria-hidden />}>Soon</Badge>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

import Link from "next/link";
import { Flame, Hourglass, Sparkle, TrendUp } from "@phosphor-icons/react/dist/ssr";
import { loadCore, getObs } from "@/lib/load";
import { TREND_LABEL } from "@/lib/format";
import { Badge, Empty, ErrorNote, PageHeader, Section, When } from "@/components/ui";
import { Photo } from "@/components/photo";
import { Bars } from "@/components/bars";
import type { Idea, TopicObs } from "@/lib/types";

const ORDER = ["rising", "popular", "new", "insufficient_data"] as const;
const SHORT: Record<string, string> = { insufficient_data: "Too early" }; // tile label; the full wording stays in title, aria-label and the section below
const day = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const META = {
  rising: { Icon: TrendUp, tile: "bg-accent-deep text-white", say: "Gaining sources or engagement" },
  popular: { Icon: Flame, tile: "bg-info-200/60 text-info-700", say: "Seen widely across days" },
  new: { Icon: Sparkle, tile: "bg-ok-200/60 text-ok-700", say: "First sighting" },
  insufficient_data: { Icon: Hourglass, tile: "bg-surface text-muted", say: "Needs more days of history" },
} as const;

/** Bars only when there are 2+ real observation days: height is the number of independent origins that day. */
function History({ rows }: { rows: TopicObs[] }) {
  if (!rows.length) return <p className="t-meta">No observations in the last 30 days.</p>;
  if (rows.length < 2) return <p className="t-meta">First seen <When iso={rows[0].obs_date} />. A trend line needs a second day.</p>;
  const max = Math.max(...rows.map((r) => r.origins?.length ?? 0), 1);
  return (
    <figure>
      <Bars label={`Sources per day: ${rows.map((r) => `${r.obs_date} ${r.origins?.length ?? 0}`).join(", ")}`} bars={rows.map((r) => ({ key: r.obs_date, h: Math.max(12, ((r.origins?.length ?? 0) / max) * 100) }))} />
      <figcaption className="t-meta mt-1.5 flex justify-between font-mono"><span>{day(rows[0].obs_date)}</span><span>{day(rows[rows.length - 1].obs_date)}</span></figcaption>
    </figure>
  );
}

export default async function Trends() {
  const [d, o] = await Promise.all([loadCore(), getObs(30)]);
  const obs: TopicObs[] = o.ok ? o.data : [];
  const topics = new Map<string, Idea[]>();
  for (const i of d.ideas) if (i.trend?.topic_key) topics.set(i.trend.topic_key, [...(topics.get(i.trend.topic_key) ?? []), i]);
  const cards = [...topics.entries()].map(([key, ideas]) => ({ key, ideas, trend: ideas[0].trend!, history: obs.filter((x) => x.topic_key === key) }));
  const days = new Set(obs.map((x) => x.obs_date)).size;
  const count = (c: string) => cards.filter((x) => (x.trend.class ?? "insufficient_data") === c).length;

  return (
    <>
      <PageHeader title="Trends" back="/more" lead={o.ok ? `Based on ${days} ${days === 1 ? "day" : "days"} of runs.` : "Rising and popular need run history."} />
      {!o.ok && <div className="mb-4"><ErrorNote what="Observation history is unavailable." detail="Showing classifications only." /></div>}

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Trend summary">
        {ORDER.map((c) => { const { Icon, tile } = META[c]; return (
          <li key={c} className="h-full"><a href={`#${c}`} aria-label={`${count(c)} ${TREND_LABEL[c]}`} className="flex h-full min-h-[68px] items-center gap-3 press-card rounded-card bg-paper p-3 shadow-[var(--shadow-e2)]">
            <span className={`grid size-10 shrink-0 place-items-center rounded-full ${tile}`}><Icon size={20} weight="fill" aria-hidden /></span>
            <span className="min-w-0"><span className="block font-mono text-[1.5rem] font-bold leading-none tabular tracking-[-0.03em]">{count(c)}</span><span className="t-meta mt-1 block truncate" title={TREND_LABEL[c]}>{SHORT[c] ?? TREND_LABEL[c]}</span></span>
          </a></li>
        ); })}
      </ul>

      {cards.length === 0 ? <div className="mt-6"><Empty title="No trend data yet" body="Trends appear after discovery has run on more than one day." /></div> : (
        ORDER.map((cls) => {
          const all = cards.filter((c) => (c.trend.class ?? "insufficient_data") === cls);
          if (!all.length) return null;
          const rows = cls === "insufficient_data" ? all.slice(0, 6) : all; // the long tail adds noise, not signal
          const { Icon, tile, say } = META[cls];
          return (
            <div key={cls} id={cls} className="scroll-mt-4"><Section title={`${TREND_LABEL[cls]}`} aside={<span className="t-meta flex-1 text-right">{say}</span>}>
              <ul className="grid gap-3 md:grid-cols-2">
                {rows.map((c) => {
                  const sources = [...new Set(c.ideas.flatMap((i) => i.evidence.map((e) => e.source).filter(Boolean)))];
                  return (
                    <li key={c.key} className="flex h-full flex-col overflow-hidden rounded-card-lg bg-paper shadow-[var(--shadow-e2)]">
                      <div className="flex gap-3 p-4">
                        <span className={`grid size-11 shrink-0 place-items-center rounded-card ${tile}`}><Icon size={22} weight="fill" aria-hidden /></span>
                        <div className="min-w-0"><Badge tone={cls === "rising" ? "accent" : cls === "popular" ? "info" : cls === "new" ? "ok" : "neutral"}>{TREND_LABEL[cls]}</Badge><h3 className="t-heading mt-1.5">{c.ideas[0].title}</h3></div>
                      </div>
                      <div className="space-y-4 px-4 pb-4">
                        {c.trend.explanation && <p className="t-meta text-[14px]">{c.trend.explanation}</p>}
                        <History rows={c.history} />
                        <div>
                          <p className="t-eyebrow mb-1.5">Related ideas</p>
                          {c.ideas.slice(0, 2).map((i) => (
                            <Link key={i.id} href={`/library/${i.id}`} className="press-card flex min-h-14 items-center gap-3 rounded-card-sm py-1">
                              <span className="size-12 shrink-0 overflow-hidden rounded-card-sm shadow-photo"><Photo id={i.id} /></span>
                              <span className="line-clamp-2 text-[15px] font-medium leading-snug">{i.title}</span>
                            </Link>
                          ))}
                        </div>
                        <p className="t-meta">{sources.length ? `Sources: ${sources.slice(0, 5).join(", ")}. ` : ""}Last seen <When iso={c.ideas[0].saved_at} />.</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {all.length > rows.length && <p className="t-meta mt-3">{all.length - rows.length} more topics have too little history to show.</p>}
            </Section></div>
          );
        })
      )}
    </>
  );
}

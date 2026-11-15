import Link from "next/link";
import { Compass, BookmarksSimple, Star, TrendUp, ImageSquare, FilmSlate, PaperPlaneTilt, Lightning, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { loadCore } from "@/lib/load";
import { timeAgo, TREND_LABEL, host, isFresh } from "@/lib/format";
import { Badge, Card, Empty, ErrorNote, Section, Shelf, Stat } from "@/components/ui";
import { IdeaCard } from "@/components/idea-card";
import { Photo } from "@/components/photo";
import { Rise } from "@/components/rise";
import { Hero, type Pick } from "@/components/hero";
import { Welcome, Recent } from "@/components/personal";
import { SearchLink } from "@/components/search-hint";
import type { Idea } from "@/lib/types";

const SOON = [
  { name: "Asset Studio", Icon: ImageSquare },
  { name: "Production Studio", Icon: FilmSlate },
  { name: "Publishing Studio", Icon: PaperPlaneTilt },
];
const NAME = process.env.STUDIO_USER_NAME || "Nitin";
const origin = (i: Idea) => i.evidence[0]?.source || host(i.url) || "Unknown source";

export default async function Home() {
  const d = await loadCore();
  const live = d.latestIdeas.filter((i) => d.states[i.id] !== "archived");
  const runAt = d.latestIdeas[0]?.saved_at;
  const fresh = isFresh(runAt); // never call old results "today's"
  const rising = d.latestIdeas.filter((i) => i.trend?.class && i.trend.class !== "insufficient_data");
  const opportunities = rising.filter((i) => i.claim_status === "first_party" || i.claim_status === "corroborated");
  const shortlisted = d.ideas.filter((i) => d.states[i.id] === "shortlisted").length;

  const picks: Pick[] = live.slice(0, 3).map((i) => ({ id: i.id, title: i.title, blurb: i.hook || i.reason, score: i.score, meta: `${origin(i)}, ${i.independent_sources ?? i.evidence.length} sources` }));
  const picked = new Set(picks.map((p) => p.id));

  // "Because you saved": only formats of ideas this user saved or shortlisted. No history, no section.
  const liked = new Set(d.ideas.filter((i) => ["saved", "shortlisted"].includes(d.states[i.id] ?? "")).map((i) => i.format).filter(Boolean));
  const recommended = live.filter((i) => !d.states[i.id] && !picked.has(i.id) && liked.has(i.format)).slice(0, 6);
  const shelf = live.filter((i) => !picked.has(i.id) && !recommended.includes(i)).slice(0, 6);

  const activity = [
    ...d.runs.slice(0, 3).map((r) => ({ at: r.generated_at, text: `Discovery run finished with ${r.ideas.length} ideas${r.complete ? "" : " (some sources failed)"}` })),
    ...d.ideas.filter((i) => i.brief_at).slice(0, 3).map((i) => ({ at: i.brief_at!, text: `Brief written for "${i.title}"` })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 4);

  return (
    <>
      {d.error && <div className="mb-5"><ErrorNote what="Could not reach the ideas database." /></div>}

      <Rise><Welcome name={NAME} /></Rise>
      <Rise i={1} className="mt-5"><SearchLink count={d.ideas.length} /></Rise>

      <Rise i={2} className="mt-5">
        {picks.length ? <Hero picks={picks} label={fresh ? "Today's pick" : "Top pick from the last run"} when={runAt ? timeAgo(runAt) : ""} />
          : <Empty title="No featured idea yet" body="Run discovery and the strongest story lands here." action={<Link href="/discover" className="inline-flex h-12 items-center gap-2 rounded-ctl bg-accent-deep px-5 font-medium text-white">Open Discovery <ArrowRight size={16} weight="bold" /></Link>} />}
      </Rise>

      <Rise i={3}>
        <section aria-label="Creative pulse" className="mt-4 rounded-card-lg border border-line/60 bg-paper p-4 shadow-[var(--shadow-e2)]">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Stories read" value={d.latestRun?.items ?? "n/a"} />
            <Stat label="Ideas surfaced" value={d.latestIdeas.length} tone="accent" />
            <Stat label="Trending" value={rising.length} />
          </div>
          <p className="t-meta mt-3 border-t border-line/70 pt-3" suppressHydrationWarning>{runAt ? `From the run ${timeAgo(runAt)}.` : "No run recorded yet."}{shortlisted ? ` ${shortlisted} shortlisted by you.` : ""}</p>
        </section>
      </Rise>

      <nav aria-label="Quick actions" className="mt-4 grid grid-cols-4 gap-2 lg:max-w-xl">
        {[
          { href: "/discover", label: "Discover", Icon: Compass },
          { href: "/library", label: "Library", Icon: BookmarksSimple },
          { href: "/library", label: "Shortlist", Icon: Star },
          { href: "/trends", label: "Trends", Icon: TrendUp },
        ].map(({ href, label, Icon }) => (
          <Link key={label} href={href} data-ia="pop" className="press flex flex-col items-center gap-2 rounded-card py-3 text-[14px] font-medium">
            <span className="grid size-14 place-items-center rounded-card bg-accent-soft text-accent-deep"><Icon size={26} weight="duotone" aria-hidden /></span>{label}
          </Link>
        ))}
      </nav>

      <Recent known={Object.fromEntries(d.ideas.map((i) => [i.id, i.title]))} />

      {recommended.length > 0 && (
        <Section title="Recommended for you" aside={<span className="t-meta flex-1 text-right">Based on ideas you saved</span>}>
          <Shelf label="Recommended ideas">{recommended.map((i) => <IdeaCard key={i.id} idea={i} variant="shelf" />)}</Shelf>
        </Section>
      )}

      {(opportunities.length > 0 || rising.length > 0) && (
        <Section title="Creative opportunities" href="/trends" aside={<span className="t-meta flex-1 text-right">{opportunities.length ? "Rising, well sourced" : "Rising now"}</span>}>
          <Shelf label="Rising topics">
            {(opportunities.length ? opportunities : rising).slice(0, 6).map((i) => (
              <Link key={i.id} role="listitem" href={`/library/${i.id}`} className="relative flex h-52 w-[68%] max-w-[260px] flex-col justify-end overflow-hidden rounded-card-lg p-4 text-white shadow-photo lift press-card sm:w-[260px]">
                <div className="absolute inset-0"><Photo id={i.id} /></div>
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/45 to-transparent" />
                <span className="relative"><Badge tone="accent">{TREND_LABEL[i.trend!.class!]}</Badge></span>
                <p className="relative mt-2 line-clamp-3 text-[16px] font-medium leading-snug">{i.title}</p>
              </Link>
            ))}
          </Shelf>
        </Section>
      )}

      <Section title="Worth exploring" href="/library" linkLabel="Library">
        {shelf.length ? <Shelf label="Ideas worth exploring">{shelf.map((i) => <IdeaCard key={i.id} idea={i} variant="shelf" />)}</Shelf>
          : <Empty title="Nothing else yet" body="More ideas appear after the next discovery run." />}
      </Section>

      <Section title="Systems">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <Card tone="accent">
            <span className="grid size-12 place-items-center rounded-card bg-accent-deep text-white"><Compass size={26} weight="fill" aria-hidden /></span>
            <h3 className="t-title mt-4">Content Discovery</h3>
            <p className="t-body mt-1 max-w-[40ch] text-ink/80">Reads your sources, clusters the noise and ranks what is worth filming.</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/discover" data-ia="nudge" className="inline-flex h-12 items-center gap-2 rounded-ctl bg-ink px-5 text-[16px] font-medium text-bg transition-transform active:scale-[0.97]">Open studio <ArrowRight size={16} weight="bold" aria-hidden /></Link>
              <Badge tone={d.source === "supabase" ? "ok" : "warn"}>{d.source === "supabase" ? "Connected" : "Local copy"}</Badge>
            </div>
          </Card>
          <ul className="grid grid-cols-3 gap-3 lg:grid-cols-1">
            {SOON.map(({ name, Icon }) => (
              <li key={name} className="flex flex-col gap-2 rounded-card-lg bg-surface/70 p-3 lg:flex-row lg:items-center">
                <Icon size={24} className="text-muted" aria-hidden />
                <p className="text-[14px] font-medium leading-tight lg:flex-1">{name}</p><Badge>Soon</Badge>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="Recent activity">
        {activity.length ? (
          <ul className="space-y-2">
            {activity.map((a, n) => (
              <li key={n} className="flex items-start gap-3 rounded-card bg-paper p-3 shadow-card">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-deep"><Lightning size={18} weight="fill" aria-hidden /></span>
                <p className="flex-1 text-[15px] leading-snug">{a.text}</p><span className="t-meta shrink-0 font-mono" suppressHydrationWarning>{timeAgo(a.at)}</span>
              </li>
            ))}
          </ul>
        ) : <Empty title="Nothing yet" body="Activity appears after the first run." />}
      </Section>
    </>
  );
}

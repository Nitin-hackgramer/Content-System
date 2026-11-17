import { notFound } from "next/navigation";
import { ArrowUpRight, ShieldCheck, ShieldWarning, Newspaper, ListChecks, Sparkle, Lightbulb, Quotes } from "@phosphor-icons/react/dist/ssr";
import { loadCore } from "@/lib/load";
import { claimLabel, TREND_LABEL, host, safeHref, timeAgo } from "@/lib/format";
import { Badge, ScoreRing, Stat, When } from "@/components/ui";
import { BackButton } from "@/components/back";
import { Chev } from "@/components/chev";
import { Photo } from "@/components/photo";
import { Track } from "@/components/personal";
import { IdeaActions } from "@/components/idea-actions";
import { BriefButton } from "@/components/brief-button";
import { DetailShell } from "@/components/morph";
import { AssetEntry } from "@/components/asset-entry";

const LEVEL: Record<string, string> = { engagement: "Measured engagement", single_source: "Single source", multi_source: "Several sources" };

function Block({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card-lg bg-paper p-4 shadow-[var(--shadow-e2)] sm:p-6">
      <h2 className="t-heading mb-4 flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent-deep" aria-hidden>{icon}</span>{title}</h2>
      {children}
    </section>
  );
}

export default async function IdeaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await loadCore();
  const idea = d.ideas.find((i) => i.id === id);
  if (!idea) notFound();
  const status = d.states[id];
  const b = idea.brief && !idea.brief.error && !idea.brief.rejected ? idea.brief : null;
  const flags = [...idea.warnings, ...idea.penalties];
  const good = !idea.needs_verification && (idea.claim_status === "first_party" || idea.claim_status === "corroborated");
  const n = idea.independent_sources ?? idea.evidence.length;

  return (
    <DetailShell id={idea.id} fallback="/library"
      cover={<><Photo id={idea.id} priority /><div aria-hidden className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-ink/40 to-transparent" /></>}
      overlay={<><BackButton fallback="/library" label="Back" className="absolute left-4 top-[calc(12px+env(safe-area-inset-top,0px))]" /><div className="absolute -bottom-6 right-4"><ScoreRing value={idea.score} size={60} /></div></>}>
      <Track id={idea.id} />

      <div className="mt-6 flex flex-wrap gap-1.5">
        {idea.format && <Badge tone="accent">{idea.format}</Badge>}
        {idea.trend?.class && idea.trend.class !== "insufficient_data" && <Badge tone="info">{TREND_LABEL[idea.trend.class]}</Badge>}
      </div>
      <h1 className="t-editorial mt-3 text-[2rem] sm:text-5xl">{idea.title}</h1>
      <p className="t-meta mt-3">Found <When iso={idea.saved_at} />{idea.published && <>, published <When iso={idea.published} /></>}</p>

      {idea.hook && (
        <div className="mt-5 rounded-card-lg bg-[image:var(--terracotta-tint)] p-5 ring-1 ring-inset ring-[var(--terracotta-line)]">
          <p className="t-eyebrow mb-2 flex items-center gap-1.5 text-accent-deep"><Quotes size={16} weight="fill" aria-hidden />Opening hook</p>
          <p className="t-editorial text-ink">{idea.hook}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-card-lg bg-surface p-4">
        <Stat label="Independent sources" value={n} />
        <Stat label="Evidence" value={<span className="text-[1.0625rem] font-sans font-medium leading-tight">{LEVEL[idea.evidence_level ?? ""] ?? "Unrated"}</span>} />
        <Stat label="Claim" value={<span className="text-[1.0625rem] font-sans font-medium leading-tight">{claimLabel(idea.claim_status)}</span>} />
      </div>

      <div className="mt-4 hidden lg:block lg:max-w-md"><IdeaActions id={id} status={status} labels /></div>

      <AssetEntry ideaId={idea.id} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-4">
          {idea.summary && <p className="t-body px-1 text-[1.0625rem] leading-relaxed text-ink/90">{idea.summary}</p>}

          <Block icon={<Newspaper size={20} weight="fill" />} title="Supporting stories">
            {idea.evidence.length ? (
              <ul className="space-y-3">
                {idea.evidence.map((e, k) => {
                  const href = safeHref(e.url);
                  const m = Object.entries(e.metrics ?? {});
                  const who = e.source || host(e.url) || "?";
                  return (
                    <li key={k} className="flex gap-3 rounded-card bg-surface/70 p-3">
                      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-ink font-medium text-bg">{who[0].toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="t-meta">{[e.source, e.author].filter(Boolean).join(", ") || "Unknown source"}{e.published ? `, ${timeAgo(e.published)}` : ""}</p>
                        <p className="mt-0.5 text-[16px] font-medium leading-snug">{e.title || host(e.url)}</p>
                        {m.length > 0 && <p className="mt-1 font-mono text-[13px] text-muted">{m.map(([key, v]) => `${v.toLocaleString("en-GB")} ${key}`).join("   ")}</p>}
                        {href && <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex h-11 items-center gap-1 rounded-ctl bg-paper px-3 text-[15px] font-medium text-accent-deep shadow-[inset_0_0_0_1px_var(--line)]">Open on {host(href)}<ArrowUpRight size={16} weight="bold" aria-hidden /></a>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="t-body text-muted">No supporting links were saved with this idea.</p>}
            {safeHref(idea.url) && <a href={safeHref(idea.url)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex h-11 items-center gap-1 text-[15px] font-medium text-accent-deep">Main link: {host(idea.url)}<ArrowUpRight size={16} weight="bold" aria-hidden /></a>}
          </Block>

          <Block icon={<Sparkle size={20} weight="fill" />} title="Generated brief">
            {b ? (
              <div className="space-y-6">
                {b.hook && <p className="t-editorial">{b.hook}</p>}
                {!!b.beats?.length && (
                  <ol className="relative space-y-4 border-l-2 border-accent-soft pl-5">
                    {b.beats.map((x, k) => (
                      <li key={k} className="relative">
                        <span className="absolute -left-[31px] top-0 grid size-6 place-items-center rounded-full bg-accent-deep font-mono text-[13px] font-medium text-white">{k + 1}</span>
                        <p className="text-[16px] leading-snug">{x.say}</p><p className="t-meta mt-1">Show: {x.show}</p>
                      </li>
                    ))}
                  </ol>
                )}
                {!!b.on_screen_text?.length && <div><h3 className="t-eyebrow mb-2">On-screen text</h3><ul className="flex flex-wrap gap-2">{b.on_screen_text.map((t, k) => <li key={k} className="rounded-ctl bg-ink px-3 py-2 text-[14px] font-medium text-bg">{t}</li>)}</ul></div>}
                {!!b.verified_facts?.length && <div className="rounded-card bg-ok-200/30 p-4"><h3 className="mb-2 flex items-center gap-1.5 text-[15px] font-medium text-ok-700"><ShieldCheck size={18} weight="fill" aria-hidden />Verified from the sources</h3><ul className="list-disc space-y-1 pl-5 text-[15px]">{b.verified_facts.map((t, k) => <li key={k}>{t}</li>)}</ul></div>}
                {!!b.claims_to_verify?.length && <div className="rounded-card bg-warn-200/35 p-4"><h3 className="mb-2 flex items-center gap-1.5 text-[15px] font-medium text-warn-700"><ShieldWarning size={18} weight="fill" aria-hidden />Check before posting</h3><ul className="list-disc space-y-1 pl-5 text-[15px]">{b.claims_to_verify.map((t, k) => <li key={k}>{t}</li>)}</ul></div>}
                {b.audit && <p className="t-meta">Evidence audit: {b.audit.status ?? "unknown"}, {b.audit.removed?.length ?? 0} of {b.audit.statements ?? 0} statements removed.</p>}
                {b.cta && <p className="text-[16px]"><span className="text-muted">Closing line: </span>{b.cta}</p>}
              </div>
            ) : (
              <div>
                <p className="t-body mb-4 text-muted">{idea.brief?.rejected ? `The last brief was rejected by the evidence check: ${idea.brief.rejected}` : idea.brief?.error ? "The last attempt to write a brief failed." : "No brief yet. It is written on request, from the evidence above."}</p>
                <BriefButton id={id} enabled={d.canRun} />
              </div>
            )}
          </Block>
        </div>

        <aside className="space-y-4">
          <Block icon={<ListChecks size={20} weight="fill" />} title="Evidence and verification">
            <div className={`mb-3 flex items-start gap-2 rounded-card p-3 text-[15px] font-medium ${good ? "bg-ok-200/35 text-ok-700" : "bg-warn-200/35 text-warn-700"}`}>
              {good ? <ShieldCheck size={22} weight="fill" aria-hidden className="shrink-0" /> : <ShieldWarning size={22} weight="fill" aria-hidden className="shrink-0" />}
              <p>{idea.needs_verification ? "Unverified claim about an announcement. Check it before you say it." : good ? (idea.claim_status === "first_party" ? "The organisation's own post. What it says about itself is still its claim." : `${n} independent sources report this.`) : "One third-party voice. Attribute it, do not state it as fact."}</p>
            </div>
            <details className="group mt-1 rounded-card-sm bg-surface/60 px-3">
              <summary className="flex h-11 cursor-pointer list-none items-center justify-between text-[15px] font-medium [&::-webkit-details-marker]:hidden">How this was scored<Chev className="text-muted" /></summary>
              <dl className="space-y-2.5 pb-3 text-[15px]">
                <Row k="Scored by" v={idea.scored_by ?? "Unknown"} />
                {idea.hook_audit && <Row k="Hook check" v={idea.hook_audit} />}
              </dl>
            </details>
            {idea.trend?.explanation && <p className="t-meta mt-3">{idea.trend.explanation}</p>}
            {flags.length > 0 && <ul className="mt-3 space-y-2">{flags.map((w, k) => <li key={k} className="rounded-card-sm bg-warn-200/35 px-3 py-2 text-[14px] text-warn-700">{w}</li>)}</ul>}
          </Block>

          <Block icon={<Lightbulb size={20} weight="fill" />} title="Angle and talking points">
            {idea.format && <p className="text-[16px]"><span className="text-muted">Suggested format: </span><span className="font-medium">{idea.format}</span></p>}
            {idea.reason && <p className="t-body mt-2 text-muted">{idea.reason}</p>}
            {b?.beats?.length ? <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px]">{b.beats.map((x, k) => <li key={k}>{x.say}</li>)}</ul> : <p className="t-meta mt-3">Talking points appear once a brief is written.</p>}
          </Block>
        </aside>
      </div>

      {/* Thumb-reach action bar on phones */}
      <div className="dock fixed inset-x-4 bottom-[calc(12px+var(--safe-b))] z-30 mx-auto max-w-md rounded-[28px] p-2 lg:hidden"><IdeaActions id={id} status={status} labels /></div>
    </DetailShell>
  );
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;

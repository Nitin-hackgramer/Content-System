import Link from "next/link";
import { ArrowRight, TrendUp } from "@phosphor-icons/react/dist/ssr";
import { Badge, ScoreRing, Verify } from "./ui";
import { Photo } from "./photo";
import { IdeaActions } from "./idea-actions";
import { TREND_LABEL, timeAgo, host } from "@/lib/format";
import type { Idea, IdeaStatus } from "@/lib/types";

type Variant = "standard" | "featured" | "shelf";

function meta(idea: Idea) {
  const n = idea.independent_sources ?? idea.evidence.length;
  const origin = idea.evidence[0]?.source || host(idea.url) || "Unknown source";
  return `${origin}, ${n} ${n === 1 ? "source" : "sources"}, ${timeAgo(idea.saved_at)}`;
}

const trendBadge = (idea: Idea) => {
  const t = idea.trend?.class;
  return t && t !== "insufficient_data" ? <Badge tone="accent" icon={<TrendUp size={14} weight="bold" aria-hidden />}>{TREND_LABEL[t]}</Badge> : null;
};

export function IdeaCard({ idea, status, variant = "standard" }: { idea: Idea; status?: IdeaStatus; variant?: Variant }) {
  const href = `/library/${idea.id}`;
  const blurb = idea.hook || idea.reason;

  if (variant === "featured") {
    return (
      <article className="lift overflow-hidden rounded-card-lg bg-paper shadow-lift">
        <Link href={href} data-idea={idea.id} className="press-card block">
          <div className="relative h-44 sm:h-56"><Photo id={idea.id} />
            <div className="absolute bottom-3 left-4 flex gap-1.5">{trendBadge(idea)}</div>
            <div className="absolute -bottom-5 right-4"><ScoreRing value={idea.score} size={52} /></div>
          </div>
          <div className="p-4 pt-5 sm:p-6">
            <h3 className="t-editorial pr-12">{idea.title}</h3>
            {blurb && <p className="t-body mt-2 line-clamp-3 text-muted">{blurb}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1"><Verify status={idea.claim_status} sources={idea.independent_sources} needs={idea.needs_verification} /><span className="t-meta">{meta(idea)}</span></div>
          </div>
        </Link>
        <div className="flex items-center justify-between gap-3 px-4 pb-4 sm:px-6 sm:pb-6">
          <Link href={href} data-ia="nudge" className="inline-flex h-11 items-center gap-1 text-[15px] font-medium text-accent-deep">Open idea <ArrowRight size={16} weight="bold" aria-hidden /></Link>
          <IdeaActions id={idea.id} status={status} compact />
        </div>
      </article>
    );
  }

  if (variant === "shelf") {
    return (
      <article role="listitem" className="lift w-[72%] max-w-[280px] sm:w-[260px]">
        <Link href={href} data-idea={idea.id} className="press-card block">
          <div className="relative aspect-[4/3] overflow-hidden rounded-card shadow-photo"><Photo id={idea.id} /><div className="absolute right-2 top-2"><ScoreRing value={idea.score} size={40} /></div></div>
          <div className="px-0.5 pt-3.5">
            <h3 className="t-heading line-clamp-2 min-h-[2.8125rem]">{idea.title}</h3>
            <div className="mt-1.5"><Verify status={idea.claim_status} sources={idea.independent_sources} needs={idea.needs_verification} /></div>
            <p className="t-meta mt-1 truncate">{meta(idea)}</p>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="lift rounded-card-lg bg-paper p-3 shadow-card">
      <Link href={href} data-idea={idea.id} className="press-card flex gap-3.5">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-card-sm shadow-photo"><Photo id={idea.id} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="t-meta truncate pt-0.5">{idea.evidence[0]?.source || host(idea.url) || "Unknown source"}, {timeAgo(idea.saved_at)}</p>
            <ScoreRing value={idea.score} size={36} />
          </div>
          <h3 className="t-heading -mt-1 line-clamp-3">{idea.title}</h3>
        </div>
      </Link>
      {blurb && <p className="t-body mt-3 line-clamp-2 text-muted">{blurb}</p>}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3"><Verify status={idea.claim_status} sources={idea.independent_sources} needs={idea.needs_verification} />{trendBadge(idea)}</div>
        <IdeaActions id={idea.id} status={status} compact />
      </div>
    </article>
  );
}

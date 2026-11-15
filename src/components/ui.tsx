import Link from "next/link";
import clsx from "clsx";
import { WarningCircle, Tray, ShieldCheck, ShieldWarning } from "@phosphor-icons/react/dist/ssr";
import { BackButton } from "./back";
import { Rise } from "./rise";
import { dateLabel, timeAgo } from "@/lib/format";

export type Tone = "neutral" | "accent" | "error" | "warn" | "ok" | "info";

const TONE: Record<Tone, string> = {
  neutral: "bg-surface text-ink",
  accent: "bg-accent-soft text-accent-deep",
  error: "bg-error-200/50 text-error-700",
  warn: "bg-warn-200/50 text-warn-700",
  ok: "bg-ok-200/50 text-ok-700",
  info: "bg-info-200/50 text-info-700",
};

export function Badge({ tone = "neutral", icon, children }: { tone?: Tone; icon?: React.ReactNode; children: React.ReactNode }) {
  return <span className={clsx("inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium", TONE[tone])}>{icon}{children}</span>;
}

/** Primary surface is a lit paper card; `tone` variants give shelves and panels their own identity. */
export function Card({ className, tone = "paper", children, ...rest }: { className?: string; tone?: "paper" | "linen" | "ink" | "accent"; children: React.ReactNode }) {
  return (
    <div {...rest} className={clsx("rounded-card-lg p-4 sm:p-6",
      tone === "paper" && "border border-line/70 bg-paper shadow-[var(--shadow-e2)]",
      tone === "linen" && "bg-surface",
      tone === "ink" && "grain card-obsidian text-bg",
      tone === "accent" && "bg-gradient-to-br from-accent-soft to-[#f3c5ac]", className)}>{children}</div>
  );
}

export function PageHeader({ title, lead, action, back }: { title: string; lead?: string; action?: React.ReactNode; back?: string }) {
  return (
    <header className="mb-6 flex items-start gap-3">
      {back && <BackButton fallback={back} className="-ml-1 mt-0.5" />}
      <div className="min-w-0 flex-1">
        <h1 className="text-[1.875rem] font-medium leading-[1.1] tracking-[-0.02em] sm:text-4xl">{title}</h1>
        {lead && <p className="t-body mt-2 max-w-[52ch] text-muted">{lead}</p>}
      </div>
      {action}
    </header>
  );
}

export function Section({ title, href, linkLabel, children, aside }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="mt-9 first:mt-0">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="t-title shrink-0">{title}</h2>
        {aside}
        {href && <Link href={href} className="inline-flex h-11 items-center text-[15px] font-medium text-accent-deep">{linkLabel ?? "See all"}</Link>}
      </div>
      <Rise view>{children}</Rise>
    </section>
  );
}

export const Shelf = ({ children, label }: { children: React.ReactNode; label: string }) => <div className="shelf" role="list" aria-label={label}>{children}</div>;

/** Relative time for scanning ("3 hours ago"); the exact date and time is one hover or long-press away. */
export const When = ({ iso, prefix }: { iso?: string | null; prefix?: string }) => (
  <time dateTime={iso ?? undefined} title={iso ? dateLabel(iso) : undefined} suppressHydrationWarning>{prefix}{timeAgo(iso)}</time>
);

/** Mono numeral over a plain label. Composed into strips, never a grid of identical boxes. */
export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "ok" | "accent" }) {
  return (
    <div className="min-w-0">
      <div className={clsx("font-mono text-[1.5rem] font-bold leading-none tabular tracking-[-0.03em]", tone === "ok" && "text-ok-700", tone === "accent" && "text-accent-deep")}>{value}</div>
      <div className="t-meta mt-1.5">{label}</div>
    </div>
  );
}
export const Metric = Stat;

/** Quality score as a ring. The ring is the score out of 100; terracotta is the selected/primary accent. */
export function ScoreRing({ value, size = 44, onDark }: { value?: number | null; size?: number; onDark?: boolean }) {
  if (value == null) return <span className="font-mono text-[13px] text-muted">n/a</span>;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span role="img" aria-label={`Quality score ${Math.round(pct)} out of 100`} title="Quality score out of 100"
      className="relative inline-grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(var(--accent) ${pct * 3.6}deg, ${onDark ? "rgb(245 242 236 / .18)" : "var(--linen-deep)"} 0)` }}>
      <span className={clsx("grid place-items-center rounded-full font-mono font-medium tabular", onDark ? "bg-ink text-bg" : "bg-paper text-ink")}
        style={{ width: size - 8, height: size - 8, fontSize: size * 0.32 }}>{Math.round(pct)}</span>
    </span>
  );
}
export const Score = ({ value }: { value?: number | null }) => <ScoreRing value={value} size={40} />;

/** Verification shown with icon AND words, never colour alone. */
export function Verify({ status, sources, needs }: { status?: string; sources?: number; needs?: boolean }) {
  const good = !needs && (status === "first_party" || status === "corroborated");
  const label = needs ? "Needs checking" : status === "first_party" ? "Official post" : status === "corroborated" ? `${sources ?? 2} sources agree` : "Unverified";
  return (
    <span className={clsx("inline-flex items-center gap-1 text-[13px] font-medium", good ? "text-ok-700" : "text-warn-700")}>
      {good ? <ShieldCheck size={16} weight="fill" aria-hidden /> : <ShieldWarning size={16} weight="fill" aria-hidden />}{label}
    </span>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={clsx("skeleton", className)} />;

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-card-lg bg-surface/60 px-6 py-10 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-paper text-accent-deep shadow-card"><Tray size={26} aria-hidden /></span>
      <p className="t-heading mt-4">{title}</p>
      <p className="t-body mx-auto mt-1 max-w-[38ch] text-muted">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Inline, compact. Persistent backend problems use <Notice> (dismissible) instead. */
export function ErrorNote({ what, detail }: { what: string; detail?: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-card-sm bg-error-200/30 px-3 py-2.5 text-[14px] text-error-700">
      <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
      <p><span className="font-medium">{what}</span>{detail ? ` ${detail}` : ""}</p>
    </div>
  );
}

export const btn = {
  base: "inline-flex h-12 items-center justify-center gap-2 rounded-ctl px-5 text-[16px] font-medium press transition-[transform,background-color,box-shadow] disabled:opacity-50 disabled:active:scale-100",
  primary: "bg-gradient-to-b from-[#bd5e3a] to-[#93401f] text-white shadow-[0_8px_18px_-8px_rgb(147_64_31/0.75)] hover:brightness-110",
  quiet: "bg-surface text-ink hover:bg-linen-deep",
  ghost: "text-ink hover:bg-surface",
  onDark: "bg-bg text-ink hover:bg-white",
};

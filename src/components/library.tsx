"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, SlidersHorizontal, X, ArrowsDownUp } from "@phosphor-icons/react";
import clsx from "clsx";
import { motion } from "motion/react";
import { IdeaCard } from "./idea-card";
import { Sheet } from "./sheet";
import { Rise } from "./rise";
import { useHint } from "./search-hint";
import { Empty, btn } from "./ui";
import { claimLabel, TREND_LABEL } from "@/lib/format";
import type { Idea, StateMap } from "@/lib/types";

type Filters = { q: string; sort: "score" | "newest"; format: string; claim: string; trend: string; view: string };
const INIT: Filters = { q: "", sort: "score", format: "", claim: "", trend: "", view: "active" };
const KEY = "studio.library";

function Chip({ on, onClick, children, slide }: { on: boolean; onClick: () => void; children: React.ReactNode; slide?: string }) {
  // slide: shared layoutId, so the obsidian pill glides to the new chip instead of swapping
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={clsx("press relative h-11 shrink-0 whitespace-nowrap rounded-full px-4 text-[15px] font-medium transition-colors duration-150",
        on ? "text-bg" : "bg-paper text-ink shadow-[inset_0_0_0_1px_var(--line)] hover:bg-surface", on && !slide && "bg-ink")}>
      {on && slide && <motion.span layoutId={slide} transition={{ type: "spring", duration: 0.32, bounce: 0 }} className="card-obsidian absolute inset-0 rounded-full" />}
      <span className="relative">{children}</span>
    </button>
  );
}

function Group({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <fieldset className="mt-5 border-0 p-0">
      <legend className="t-eyebrow mb-2">{label}</legend>
      <div className="flex flex-wrap gap-2">{options.map(([v, l]) => <Chip key={v} on={value === v} onClick={() => onChange(v)}>{l}</Chip>)}</div>
    </fieldset>
  );
}

export function Library({ ideas, states, focus }: { ideas: Idea[]; states: StateMap; focus?: boolean }) {
  const [f, setF] = useState<Filters>(INIT);
  const [sheet, setSheet] = useState(false);
  const ready = useRef(false);
  const restoring = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const hint = useHint(!f.q);

  // Restore filters and scroll when coming back from an idea; save them on the way out.
  useEffect(() => {
    try {
      const s = sessionStorage.getItem(KEY);
      if (s) {
        const { f: sf, y } = JSON.parse(s);
        setF({ ...INIT, ...sf }); // eslint-disable-line react-hooks/set-state-in-effect -- one-time restore from sessionStorage after hydration
        // Next may scroll to the top after this page mounts (it streams in behind loading.tsx), so keep putting it back until it holds.
        let tries = 0;
        restoring.current = true;
        const put = () => { window.scrollTo(0, y || 0); if (Math.abs(window.scrollY - (y || 0)) > 2 && tries++ < 12) setTimeout(put, 60); else restoring.current = false; };
        requestAnimationFrame(put);
      }
    } catch {}
    ready.current = true;
    if (focus) input.current?.focus();
  }, [focus]);
  useEffect(() => {
    if (!ready.current) return;
    const save = () => { if (restoring.current) return; try { sessionStorage.setItem(KEY, JSON.stringify({ f, y: window.scrollY })); } catch {} };
    save();
    window.addEventListener("pagehide", save);
    document.addEventListener("click", save, true); // a tap on a card: capture the scroll before navigating
    return () => { window.removeEventListener("pagehide", save); document.removeEventListener("click", save, true); };
  }, [f]);

  const formats = useMemo(() => [...new Set(ideas.map((i) => i.format).filter(Boolean))], [ideas]);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }));

  const list = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return ideas
      .filter((i) => {
        const st = states[i.id];
        if (f.view === "active" ? st === "archived" : f.view === "all" ? false : st !== f.view) return false;
        if (f.format && i.format !== f.format) return false;
        if (f.claim && i.claim_status !== f.claim) return false;
        if (f.trend && (i.trend?.class ?? "insufficient_data") !== f.trend) return false;
        return !q || `${i.title} ${i.hook} ${i.summary}`.toLowerCase().includes(q);
      })
      .sort((a, b) => (f.sort === "score" ? (b.score ?? -1) - (a.score ?? -1) : Date.parse(b.saved_at) - Date.parse(a.saved_at) || a.rank - b.rank));
  }, [ideas, states, f]);

  const advanced = [f.claim, f.trend, f.view !== "active" ? f.view : "", f.sort !== "score" ? f.sort : ""].filter(Boolean).length;
  const showFeatured = !f.q && list.length > 2 && f.sort === "score";

  return (
    <>
      <div className="bar-glass sticky top-0 z-20 -mx-4 bg-bg/80 px-4 backdrop-blur-xl pb-3 pt-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex gap-2">
          <label data-ia-focus="grow" className="relative min-w-0 flex-1">
            <span className="sr-only">Search ideas</span>
            <MagnifyingGlass size={22} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input ref={input} type="search" enterKeyHint="search" autoComplete="off" spellCheck={false} value={f.q} onChange={(e) => set("q", e.target.value)} placeholder={hint}
              className="h-14 w-full rounded-full border-0 bg-paper pl-12 pr-4 text-ink shadow-card ring-1 ring-line/70 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-deep" />
          </label>
          <button type="button" onClick={() => setSheet(true)} data-ia="tilt" className="press card-obsidian relative grid size-14 shrink-0 place-items-center rounded-full text-bg" aria-label={`Sort and filter${advanced ? `, ${advanced} active` : ""}`}>
            <SlidersHorizontal size={22} />
            {advanced > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-accent font-mono text-[12px] font-medium text-ink">{advanced}</span>}
          </button>
        </div>
        {formats.length > 0 && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0" role="group" aria-label="Category">
            <Chip slide="fmt" on={!f.format} onClick={() => set("format", "")}>All</Chip>
            {formats.map((x) => <Chip slide="fmt" key={x} on={f.format === x} onClick={() => set("format", f.format === x ? "" : x)}>{x}</Chip>)}
          </div>
        )}
      </div>

      <div className="mb-3 mt-1 flex items-center justify-between">
        <p className="t-meta" role="status">{list.length} {list.length === 1 ? "idea" : "ideas"}{f.sort === "newest" ? ", newest first" : ", best first"}</p>
        <button type="button" onClick={() => set("sort", f.sort === "score" ? "newest" : "score")} data-ia="tilt" className="inline-flex h-11 items-center gap-1.5 text-[14px] font-medium text-accent-deep"><ArrowsDownUp size={16} aria-hidden />{f.sort === "score" ? "By score" : "By date"}</button>
      </div>

      {list.length === 0 ? (
        <Empty title="Nothing matches" body={ideas.length ? "Loosen a filter or clear the search." : "No ideas yet. Run discovery to collect the first batch."}
          action={ideas.length ? <button className={clsx(btn.base, btn.quiet)} onClick={() => setF(INIT)}><X size={16} />Clear filters</button> : undefined} />
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          {list.map((i, n) => (
            <li key={i.id} className={clsx(showFeatured && n === 0 && "md:col-span-2")}>
              <Rise i={n}><IdeaCard idea={i} status={states[i.id]} variant={showFeatured && n === 0 ? "featured" : "standard"} /></Rise>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={sheet} onOpenChange={setSheet} title="Sort and filter">
        <Group label="Sort by" value={f.sort} onChange={(v) => set("sort", v as Filters["sort"])} options={[["score", "Quality score"], ["newest", "Newest"]]} />
        <Group label="Show" value={f.view} onChange={(v) => set("view", v)} options={[["active", "Not archived"], ["saved", "Saved"], ["shortlisted", "Shortlisted"], ["archived", "Archived"], ["all", "Everything"]]} />
        <Group label="Evidence" value={f.claim} onChange={(v) => set("claim", f.claim === v ? "" : v)} options={["first_party", "corroborated", "unverified"].map((c) => [c, claimLabel(c)] as [string, string])} />
        <Group label="Trend" value={f.trend} onChange={(v) => set("trend", f.trend === v ? "" : v)} options={Object.entries(TREND_LABEL)} />
        <div className="mt-7 flex gap-2">
          <button className={clsx(btn.base, btn.quiet, "flex-1")} onClick={() => setF(INIT)}>Reset</button>
          <button className={clsx(btn.base, btn.primary, "flex-[2]")} onClick={() => setSheet(false)}>Show {list.length} ideas</button>
        </div>
      </Sheet>
    </>
  );
}

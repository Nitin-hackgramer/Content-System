"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowsClockwise } from "@phosphor-icons/react";
import { project } from "@/lib/motion";
import { Photo } from "./photo";
import { ScoreRing } from "./ui";

export type Pick = { id: string; title: string; blurb: string; score?: number; meta: string };

// Which candidate is showing is kept for the browser session, so the featured idea does not change under you.
const KEY = "studio.pick", subs = new Set<() => void>();
const read = () => { try { return Number(sessionStorage.getItem(KEY)) || 0; } catch { return 0; } };
const write = (n: number) => { try { sessionStorage.setItem(KEY, String(n)); } catch {} subs.forEach((f) => f()); };
const sub = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };

/** Featured idea: its own story image full-bleed, headline over a scrim. "Another idea" cycles the top-ranked few; it never invents one. */
export function Hero({ picks, label, when }: { picks: Pick[]; label: string; when: string }) {
  const i = useSyncExternalStore(sub, read, () => 0) % picks.length;
  const p = picks[i];
  return (
    <section data-morph aria-label="Featured idea" className="card-obsidian relative isolate min-h-[27rem] overflow-hidden rounded-card-lg text-white sm:min-h-[30rem]">
      <AnimatePresence initial={false}>
        <motion.div key={p.id} className="absolute inset-0 -z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
          <Photo id={p.id} priority />
        </motion.div>
      </AnimatePresence>
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/80 to-ink/25" />
      <div className="flex min-h-[inherit] flex-col justify-between p-5 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <p className="inline-flex h-8 items-center rounded-full bg-ink/70 px-3 text-[13px] font-medium">{label}<span className="ml-2 text-white/70" suppressHydrationWarning>{when}</span></p>
          <ScoreRing value={p.score} size={48} onDark />
        </div>
        <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
          drag={picks.length > 1 ? "x" : false} dragSnapToOrigin dragElastic={0.35} dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(_, d) => { const to = d.offset.x + project(d.velocity.x); if (Math.abs(to) > 90) write(i + (to < 0 ? 1 : picks.length - 1)); }}>
          <h2 className="t-display line-clamp-5 max-w-[20ch]">{p.title}</h2>
          {p.blurb && <p className="mt-3 line-clamp-2 max-w-[46ch] text-[16px] leading-snug text-white/85">{p.blurb}</p>}
          <p className="mt-3 text-[14px] text-white/70">{p.meta}</p>
          <div className="mt-5 flex items-center gap-2">
            <Link href={`/library/${p.id}`} data-ia="nudge" className="press inline-flex h-12 items-center gap-2 rounded-ctl bg-bg px-5 text-[16px] font-medium text-ink">Open idea <ArrowRight size={18} weight="bold" aria-hidden /></Link>
            {picks.length > 1 && (
              <button type="button" onClick={() => write(i + 1)} aria-label="Show another top idea" data-ia="spin" className="press grid size-12 place-items-center rounded-ctl bg-ink/60 text-white ring-1 ring-white/30">
                <ArrowsClockwise size={20} aria-hidden />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

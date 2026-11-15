"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretRight } from "@phosphor-icons/react";
import { Photo } from "./photo";
import { timeAgo } from "@/lib/format";

// Everything here comes from what this browser actually did: last visit time and ideas opened. Nothing is guessed.
const GREET = "studio.greet", RECENT = "studio.recent";
const none = () => () => {};
const minute = (cb: () => void) => { const t = setInterval(cb, 60_000); return () => clearInterval(t); };
const ls = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

const part = () => { const h = new Date().getHours(); return h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"; };

// Warm, short, time-aware lines. The first is always the plain greeting; the rest rotate in after it. {n} is the name.
const LINES: Record<string, string[]> = {
  morning: ["Good morning, {n}.", "A fresh day. A fresh perspective.", "Ready to discover something interesting?", "Let's find your next big idea."],
  afternoon: ["Good afternoon, {n}.", "Your next great idea might be waiting.", "What's worth making today?", "Let's find your next big idea."],
  evening: ["Good evening, {n}.", "Let's find something worth making.", "Your next great idea might be waiting.", "One good idea is enough for tonight."],
  night: ["Still up, {n}?", "Quiet hours are good for ideas.", "Let's find something worth making."],
};

// Where the rotation starts moves on by one every visit, so the line you open to is not the same as last time.
let start: number | undefined;
const startAt = () => { if (start === undefined) { let n = 0; try { n = Number(localStorage.getItem(GREET)) || 0; } catch {} start = n; } return start; };

/** Time-aware greeting that gently rotates through a few short lines. No data summary: the dashboard below carries that. */
export function Welcome({ name }: { name: string }) {
  const period = useSyncExternalStore(minute, part, () => "evening");
  const base = useSyncExternalStore(none, startAt, () => 0);
  const [tick, setTick] = useState(0);
  useEffect(() => { try { localStorage.setItem(GREET, String(startAt() + 1)); } catch {} }, []);
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const t = setInterval(() => { if (!document.hidden && !reduce.matches) setTick((n) => n + 1); }, 7000); // reduced motion keeps the plain greeting
    return () => clearInterval(t);
  }, []);
  const lines = LINES[period];
  const text = lines[(tick === 0 ? 0 : base + tick) % lines.length].replace("{n}", name);
  return (
    <h1 className="relative h-[4.25rem] overflow-hidden text-[1.75rem] font-medium leading-[1.15] tracking-[-0.02em]">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={text} className="block" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -22 }} transition={{ duration: 0.38, ease: [0.2, 0.7, 0.2, 1] }}>{text}</motion.span>
      </AnimatePresence>
    </h1>
  );
}

/** Records that an idea was opened. */
export function Track({ id }: { id: string }) {
  useEffect(() => {
    try {
      const cur = (JSON.parse(localStorage.getItem(RECENT) || "[]") as { id: string }[]).filter((r) => r.id !== id);
      localStorage.setItem(RECENT, JSON.stringify([{ id, at: Date.now() }, ...cur].slice(0, 8)));
    } catch {}
  }, [id]);
  return null;
}

/** Ideas this device opened most recently. Hidden until there is real history. */
export function Recent({ known }: { known: Record<string, string> }) {
  const raw = useSyncExternalStore(none, () => ls(RECENT), () => null);
  let items: { id: string; at: number }[] = [];
  try { items = JSON.parse(raw || "[]"); } catch {}
  const list = items.filter((r) => known[r.id]).slice(0, 3);
  if (!list.length) return null;
  return (
    <section className="mt-9" aria-labelledby="recent-h">
      <h2 id="recent-h" className="t-title mb-3">Pick up where you left off</h2>
      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id}>
            <Link href={`/library/${r.id}`} className="flex items-center gap-3 rounded-card border border-line/60 bg-paper p-2.5 pr-3 shadow-card transition-transform active:scale-[0.99]">
              <span className="size-14 shrink-0 overflow-hidden rounded-card-sm shadow-photo"><Photo id={r.id} /></span>
              <span className="min-w-0 flex-1">
                <span className="t-meta block" suppressHydrationWarning>Opened {timeAgo(new Date(r.at).toISOString())}</span>
                <span className="line-clamp-2 text-[16px] font-medium leading-snug">{known[r.id]}</span>
              </span>
              <CaretRight size={18} className="shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

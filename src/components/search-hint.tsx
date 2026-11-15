"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { MagnifyingGlass } from "@phosphor-icons/react";

export const HINTS = ["Find your next big idea…", "Explore emerging AI trends…", "Discover something worth creating…", "What's happening in tech today?", "Find your next viral topic…"];
const EVERY = 3800;
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Plain rotating text, for places that cannot slide (an input placeholder). Stops under reduced motion. */
export function useHint(on = true) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!on || still()) return;
    const t = setInterval(() => { if (!document.hidden) setI((n) => (n + 1) % HINTS.length); }, EVERY);
    return () => clearInterval(t);
  }, [on]);
  return HINTS[i];
}

/** Home search pill. The suggestion slides up and out (ease-in, 240ms) and the next one slides up in (ease-out, 320ms).
 *  One GSAP timeline per change, killed on unmount; under reduced motion the text just swaps. The box has a fixed height, so nothing shifts. */
export function SearchLink({ count }: { count: number }) {
  const line = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = line.current;
    if (!el) return;
    let i = 0, tl: gsap.core.Timeline | undefined;
    const t = setInterval(() => {
      if (document.hidden) return;
      i = (i + 1) % HINTS.length;
      if (still()) { el.textContent = HINTS[i]; return; }
      tl?.kill();
      tl = gsap.timeline()
        .to(el, { yPercent: -110, opacity: 0, duration: 0.24, ease: "power2.in" })
        .add(() => { el.textContent = HINTS[i]; })
        .fromTo(el, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.32, ease: "power2.out", clearProps: "transform" });
    }, EVERY);
    return () => { clearInterval(t); tl?.kill(); gsap.set(el, { clearProps: "all" }); };
  }, []);
  return (
    <Link href="/library?focus=1" aria-label={`Search ${count} ideas`} data-ia="grow" className="flex h-14 items-center gap-3 rounded-full bg-paper px-5 text-[16px] text-muted shadow-card ring-1 ring-line/70 transition-transform duration-150 active:scale-[0.99]">
      <MagnifyingGlass size={22} aria-hidden className="shrink-0" />
      <span className="relative h-6 min-w-0 flex-1 overflow-hidden"><span ref={line} className="block truncate leading-6">{HINTS[0]}</span></span>
      <span className="font-mono text-[13px] tabular text-muted">{count}</span>
    </Link>
  );
}

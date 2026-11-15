"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CaretDown } from "@phosphor-icons/react";

/** Chevron that follows its parent <details>: set instantly on load, tweened on every toggle. */
export function Chev({ size = 18, className }: { size?: number; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current, d = el?.closest("details");
    if (!el || !d) return;
    const go = (animate: boolean) => {
      const rotate = d.open ? 180 : 0;
      if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.to(el, { rotate, duration: 0.26, ease: "power2.out", overwrite: true });
      else gsap.set(el, { rotate });
    };
    go(false);
    const on = () => go(true);
    d.addEventListener("toggle", on);
    return () => { d.removeEventListener("toggle", on); gsap.killTweensOf(el); };
  }, []);
  return <CaretDown ref={ref} size={size} className={className} aria-hidden />;
}

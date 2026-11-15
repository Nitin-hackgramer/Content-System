"use client";
import { useEffect } from "react";
import gsap from "gsap";

// One delegated listener plays a named GSAP preset on the <svg> inside any element marked data-ia="preset".
// Mark a button or link, never the icon itself, and the icon (not the button) is what moves. All presets are
// transform-only, 150 to 500ms, and end by clearing their inline transform. Skipped under reduced motion.
const END = { clearProps: "transform", overwrite: true } as const;
const PRESETS: Record<string, (el: Element) => void> = {
  pop: (el) => gsap.fromTo(el, { scale: 0.65 }, { scale: 1, duration: 0.34, ease: "back.out(2.4)", ...END }), // save, nav, quick actions
  grow: (el) => gsap.fromTo(el, { scale: 1 }, { scale: 1.2, duration: 0.16, yoyo: true, repeat: 1, ease: "power2.out", ...END }), // search
  nudge: (el) => gsap.fromTo(el, { x: 0 }, { x: 4, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out", ...END }), // forward arrows
  nudgeBack: (el) => gsap.fromTo(el, { x: 0 }, { x: -4, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out", ...END }), // back arrow
  spin: (el) => gsap.fromTo(el, { rotate: 0 }, { rotate: 360, duration: 0.5, ease: "power2.inOut", ...END }), // refresh
  tilt: (el) => gsap.fromTo(el, { rotate: -16 }, { rotate: 0, duration: 0.36, ease: "back.out(3)", ...END }), // filter, sort
};
const HOVER = new Set(["nudge", "nudgeBack"]); // direction hints are the only icons that react to a mouse hovering

export function playIcon(host: Element | null, name?: string) {
  const p = PRESETS[name ?? host?.getAttribute("data-ia") ?? ""];
  const svg = host?.querySelector("svg");
  if (!p || !svg || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  p(svg);
}

export function IconMotion() {
  useEffect(() => {
    const host = (t: EventTarget | null, attr = "data-ia") => (t instanceof Element ? t.closest(`[${attr}]`) : null);
    const down = (e: PointerEvent) => playIcon(host(e.target));
    const key = (e: MouseEvent) => { if (e.detail === 0) playIcon(host(e.target)); }; // keyboard "click" (pointers already handled)
    const over = (e: PointerEvent) => {
      const h = host(e.target);
      if (e.pointerType === "mouse" && h && HOVER.has(h.getAttribute("data-ia")!) && !h.contains(e.relatedTarget as Node)) playIcon(h);
    };
    const focus = (e: FocusEvent) => playIcon(host(e.target, "data-ia-focus"), host(e.target, "data-ia-focus")?.getAttribute("data-ia-focus") ?? undefined);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("click", key, true);
    document.addEventListener("pointerover", over, true);
    document.addEventListener("focusin", focus, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("click", key, true);
      document.removeEventListener("pointerover", over, true);
      document.removeEventListener("focusin", focus, true);
      gsap.killTweensOf("svg");
    };
  }, []);
  return null;
}

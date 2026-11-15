"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { animate, motion, useDragControls, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type PanInfo } from "motion/react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { MOMENTUM_SPRING, project } from "@/lib/motion";
import { setMorph, setOrigin, takeMorph } from "@/lib/morph";
import { BackButton, goBack } from "./back";

gsap.registerPlugin(Flip);

/** Remembers where a tapped idea's photo sat, so the idea page can grow out of it. Mounted once in the shell. */
export function MorphCapture() {
  useEffect(() => {
    const on = (e: MouseEvent) => {
      const tile = (e.target as Element).closest?.("[data-origin]");
      if (tile) { const r = tile.getBoundingClientRect(); setOrigin(r.left + r.width / 2, r.top + r.height / 2); }
      const a = (e.target as Element).closest?.<HTMLAnchorElement>('a[href^="/library/"]');
      const id = a?.getAttribute("href")?.split("/")[2];
      const host = a?.closest("[data-morph]") ?? a;
      const photo = host?.querySelector("[data-photo]");
      const img = photo?.querySelector("img");
      if (!id || !host || !photo || !img || !img.complete || !img.naturalWidth || img.style.opacity !== "1") return; // only morph a photo that is actually showing
      let radius = 0, n: Element | null = photo;
      for (let k = 0; k < 4 && n && !radius; k++, n = n.parentElement) radius = parseFloat(getComputedStyle(n).borderTopLeftRadius) || 0;
      const r = host.getBoundingClientRect();
      setMorph({ id, x: r.left, y: r.top, w: r.width, h: r.height, src: img.currentSrc || img.src, radius, at: Date.now() });
    };
    document.addEventListener("click", on, true);
    return () => document.removeEventListener("click", on, true);
  }, []);
  return null;
}

/** Idea page frame. The cover photo grows out of the tapped card (GSAP Flip.fit on a ghost image). Dragging the cover down moves
 *  the whole page 1:1; on release, offset plus projected momentum decides: dismiss, or spring back carrying the finger's velocity. */
export function DetailShell({ id, fallback, overlay, cover, children }: { id: string; fallback: string; overlay: React.ReactNode; cover: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter(), reduce = useReducedMotion();
  const controls = useDragControls(), y = useMotionValue(0);
  const scale = useTransform(y, [0, 420], [1, 0.9]), radius = useTransform(y, [0, 120], [0, 32]);
  const clip = useRef<HTMLDivElement>(null), ov = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const [top, setTop] = useState(true), [chip, setChip] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => { setTop(v <= 2); setChip(v > 180); });

  useLayoutEffect(() => {
    const m = takeMorph(id), el = clip.current;
    if (!m || !el || reduce || window.scrollY > 4) return;
    const g = document.createElement("img");
    g.src = m.src; g.alt = "";
    Object.assign(g.style, { position: "fixed", left: `${m.x}px`, top: `${m.y}px`, width: `${m.w}px`, height: `${m.h}px`, objectFit: "cover", borderRadius: `${m.radius}px`, zIndex: "60", pointerEvents: "none", willChange: "transform" });
    document.body.appendChild(g);
    el.style.visibility = "hidden";
    const end = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const done = () => { el.style.visibility = ""; g.remove(); };
    const tl = gsap.timeline({ onComplete: done });
    tl.add(Flip.fit(g, el, { scale: false, duration: 0.46, ease: "power3.out" }) as gsap.core.Tween, 0)
      .to(g, { borderRadius: end, duration: 0.46, ease: "power3.out" }, 0)
      .fromTo(ov.current, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.3);
    return () => { if (tl.progress() < 1) setMorph(m); tl.kill(); done(); }; // interrupted (React dev double-mount): hand the record back
  }, [id, reduce]);

  const release = (_: unknown, i: PanInfo) => {
    const at = Math.max(0, i.offset.y), to = at + project(i.velocity.y); // offset from the gesture itself, not a frame-lagged motion value
    if (at > 180 || to > 300) animate(y, window.innerHeight, { type: "spring", duration: 0.3, bounce: 0, velocity: i.velocity.y, onComplete: () => goBack(router, fallback) });
    else animate(y, 0, { ...MOMENTUM_SPRING, velocity: i.velocity.y });
  };

  return (
    <motion.article style={{ y, scale, borderRadius: radius, transformOrigin: "50% 0%" }} drag="y" dragControls={controls} dragListener={false}
      dragConstraints={{ top: 0, bottom: 2000 }} dragElastic={{ top: 0.12, bottom: 0 }} dragMomentum={false} onDragEnd={release}>
      <div onPointerDown={(e) => { if (window.scrollY <= 2) controls.start(e); }} style={{ touchAction: top ? "none" : "auto" }}
        className="relative -mx-4 -mt-5 h-56 sm:-mx-6 lg:mx-0 lg:mt-0 lg:h-72">
        <div ref={clip} className="absolute inset-0 overflow-hidden lg:rounded-card-lg">{cover}</div>
        <div ref={ov}>{overlay}</div>
      </div>
      {chip && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", duration: 0.3, bounce: 0 }} className="fixed left-4 top-[calc(12px+env(safe-area-inset-top,0px))] z-40 lg:hidden">
          <BackButton fallback={fallback} label="Back to ideas" />
        </motion.div>
      )}
      {children}
    </motion.article>
  );
}

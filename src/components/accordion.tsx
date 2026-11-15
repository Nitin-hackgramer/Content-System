"use client";
import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretDown } from "@phosphor-icons/react";
import { UI_SPRING } from "@/lib/motion";

/** Disclosure with an interruptible, critically damped height spring (reduced motion is handled by MotionConfig in the shell).
 *  Press feedback is on the header; the chevron turns with the same spring. */
export function Accordion({ summary, defaultOpen, className, buttonClassName, children }: { summary: React.ReactNode; defaultOpen?: boolean; className?: string; buttonClassName?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen), id = useId();
  return (
    <div className={className}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className={`press-card ${buttonClassName ?? "flex w-full items-center gap-3 text-left"}`}>
        {summary}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={UI_SPRING} className="ml-auto grid shrink-0 place-items-center text-muted"><CaretDown size={18} aria-hidden /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && <motion.div id={id} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={UI_SPRING} className="overflow-hidden">{children}</motion.div>}
      </AnimatePresence>
    </div>
  );
}

"use client";
import { motion } from "motion/react";
import { UI_SPRING } from "@/lib/motion";

/** Sparkline bars that grow from the baseline once they scroll into view. `h` is the percent height, already computed from real counts. */
export function Bars({ bars, label }: { bars: { key: string; h: number }[]; label: string }) {
  return (
    <div className="flex h-12 items-end gap-1.5" role="img" aria-label={label}>
      {bars.map((b, i) => (
        <motion.span key={b.key} className="flex-1 rounded-t bg-accent" style={{ height: `${b.h}%`, originY: 1 }}
          initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ ...UI_SPRING, delay: Math.min(i, 12) * 0.03 }} />
      ))}
    </div>
  );
}

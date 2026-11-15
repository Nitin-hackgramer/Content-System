"use client";
import { motion } from "motion/react";

const ease = [0.2, 0.7, 0.2, 1] as const;

/** Entrance: 14px rise and fade. `i` staggers by position (capped); `view` waits until it scrolls into view, once.
 *  Reduced motion is handled by MotionConfig. */
export function Rise({ i = 0, view, className, children }: { i?: number; view?: boolean; className?: string; children: React.ReactNode }) {
  const t = { duration: 0.38, delay: view ? 0 : Math.min(i, 6) * 0.05, ease };
  return view ? (
    <motion.div className={className} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -8% 0px" }} transition={t}>{children}</motion.div>
  ) : (
    <motion.div className={className} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={t}>{children}</motion.div>
  );
}

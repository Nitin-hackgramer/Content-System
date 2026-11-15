"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { peekOrigin } from "@/lib/morph";

// Page transition: critically damped spring. Opened from a bento tile ([data-origin]), the page grows out of that tile's centre;
// otherwise a fade and 6px rise. Motion respects reduced-motion via MotionConfig in Shell.
export default function Template({ children }: { children: React.ReactNode }) {
  const [o] = useState(() => peekOrigin());
  return (
    <motion.div initial={o ? { opacity: 0, scale: 0.92 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      style={o ? { transformOrigin: `${o.x}px ${o.y}px` } : undefined} transition={{ type: "spring", duration: 0.4, bounce: 0 }}>
      {children}
    </motion.div>
  );
}

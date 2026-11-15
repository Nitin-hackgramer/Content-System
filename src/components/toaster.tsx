"use client";
import { useEffect, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle, Info, Warning, XCircle, X } from "@phosphor-icons/react";
import { dismissToast, getToasts, subscribe, type ToastKind } from "@/lib/toast";

const LOOK: Record<ToastKind, { Icon: typeof Info; chip: string; ms: number }> = {
  success: { Icon: CheckCircle, chip: "bg-ok-700 text-white", ms: 3200 },
  info: { Icon: Info, chip: "bg-info-700 text-white", ms: 4000 },
  warning: { Icon: Warning, chip: "bg-warn-700 text-white", ms: 5500 },
  error: { Icon: XCircle, chip: "bg-error-700 text-white", ms: 7000 },
};
const MAX = 3; // visible at once; the rest wait their turn

/** Top-origin toasts: slide down and fade in, leave upward. Auto-dismiss unless `persist`. */
export function Toaster() {
  const all = useSyncExternalStore(subscribe, getToasts, getToasts);
  const shown = all.slice(0, MAX);
  const key = shown.map((t) => t.id).join("|");

  useEffect(() => {
    const timers = shown.filter((t) => !t.persist).map((t) => setTimeout(() => dismissToast(t.id), LOOK[t.kind].ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on which toasts are visible, not on object identity
  }, [key]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+8px)] z-50 mx-auto flex max-w-md flex-col gap-2 px-3">
      <AnimatePresence initial={false}>
        {shown.map((t) => {
          const { Icon, chip } = LOOK[t.kind];
          return (
            <motion.div key={t.id} layout role={t.kind === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.2, 0.7, 0.2, 1] } }} exit={{ opacity: 0, y: -14, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
              className="pointer-events-auto flex items-center gap-3 rounded-card border border-line/70 bg-paper py-2 pl-2.5 pr-1 shadow-lift">
              <span className={`grid size-8 shrink-0 place-items-center rounded-full ${chip}`}><Icon size={18} weight="fill" aria-hidden /></span>
              <p className="min-w-0 flex-1 text-[15px] leading-snug"><span className="font-medium">{t.text}</span>{t.detail && <span className="block text-[13px] text-muted">{t.detail}</span>}</p>
              {t.action && <button type="button" onClick={() => { t.action!.run(); dismissToast(t.id); }} className="h-11 shrink-0 rounded-ctl px-3 text-[15px] font-medium text-accent-deep hover:bg-surface">{t.action.label}</button>}
              <button type="button" aria-label="Dismiss notification" onClick={() => dismissToast(t.id, true)} className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface"><X size={16} weight="bold" /></button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

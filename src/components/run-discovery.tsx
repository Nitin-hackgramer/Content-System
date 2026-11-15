"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Play, CircleNotch, CheckCircle, WarningCircle, ArrowRight } from "@phosphor-icons/react";
import { btn } from "./ui";
import { toast } from "@/lib/toast";
import clsx from "clsx";

type S = { state: "idle" | "running" | "done" | "failed" | "unavailable"; error?: string; startedAt?: number };

/** Starts the existing pipeline through /api/discover (local only), polls, then refreshes the page's data. */
export function RunDiscovery({ variant = "primary", enabled }: { variant?: "primary" | "onDark"; enabled: boolean }) {
  const router = useRouter();
  const [s, setS] = useState<S>({ state: "idle" });
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  const poll = () => {
    clearInterval(timer.current);
    timer.current = setInterval(async () => {
      const r = (await fetch("/api/discover").then((x) => x.json()).catch(() => null)) as S | null;
      if (!r || r.state === "running") return;
      clearInterval(timer.current); setS(r); router.refresh();
      if (r.state === "done") toast("Discovery finished", { detail: "New ideas are in your library." }); else toast("Discovery failed", { kind: "error", detail: "See History for the error.", persist: true, action: { label: "History", run: () => router.push("/history") } });
    }, 4000);
  };
  useEffect(() => {
    // A run may already be going (started earlier, or from another tab): show it instead of offering a second one.
    fetch("/api/discover").then((x) => x.json()).then((r: S) => { if (r.state === "running") { setS(r); poll(); } }).catch(() => {});
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function go() {
    setS({ state: "running" });
    const r = (await fetch("/api/discover", { method: "POST" }).then((x) => x.json()).catch(() => ({ state: "failed" }))) as S;
    setS(r);
    if (r.state === "running") poll();
  }

  const running = s.state === "running";
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  const secs = running && now && s.startedAt ? Math.max(0, Math.floor((now - s.startedAt) / 1000)) : 0;
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <div className="flex flex-col items-start gap-2.5">
      <button type="button" onClick={go} disabled={!enabled || running} data-ia="pop" className={clsx(btn.base, variant === "onDark" ? btn.onDark : btn.primary, running && "run-glow")}>
        {running ? <CircleNotch size={20} className="animate-spin" /> : <Play size={20} weight="fill" />}
        {running ? "Discovering…" : "Run discovery"}
      </button>
      {running && (
        <div className="w-full max-w-xs" aria-hidden>
          {/* Indeterminate on purpose: the pipeline reports no percentage, so none is invented. */}
          <div className="h-1.5 overflow-hidden rounded-full bg-current/15"><motion.span className="block h-full w-1/3 rounded-full bg-accent" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} /></div>
          {secs > 0 && <p className="mt-1.5 font-mono text-[13px] tabular opacity-80">Running {clock}</p>}
        </div>
      )}
      {s.state === "done" && <Link href="/library" data-ia="nudge" className={clsx("inline-flex h-11 items-center gap-1 text-[15px] font-medium underline-offset-4 hover:underline", variant === "onDark" ? "text-bg" : "text-accent-deep")}>See the new ideas <ArrowRight size={16} weight="bold" aria-hidden /></Link>}
      <p role="status" className={clsx("flex items-start gap-1.5 text-[13px]", s.state === "failed" ? "text-error-700" : s.state === "done" ? "text-ok-700" : variant === "onDark" ? "text-bg/70" : "text-muted")}>
        {s.state === "done" && <CheckCircle size={16} weight="fill" className="mt-px shrink-0" aria-hidden />}
        {s.state === "failed" && <WarningCircle size={16} weight="fill" className="mt-px shrink-0" aria-hidden />}
        <span>{!enabled ? "Needs the local pipeline folder (DISCOVERY_DIR)." : running ? "Takes 3 to 4 minutes. Safe to leave this page." : s.state === "done" ? "Run finished. Data refreshed." : s.state === "failed" ? `The run failed. ${s.error ?? ""} See History.` : s.state === "unavailable" ? s.error : ""}</span>
      </p>
    </div>
  );
}

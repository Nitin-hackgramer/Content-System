"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, Sparkle } from "@phosphor-icons/react";
import { btn } from "./ui";
import clsx from "clsx";

type S = { state: string; error?: string };

export function BriefButton({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter();
  const [s, setS] = useState<S>({ state: "idle" });
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => () => clearInterval(timer.current), []);

  async function go() {
    setS({ state: "running" });
    const r = (await fetch("/api/brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then((x) => x.json()).catch(() => ({ state: "failed" }))) as S;
    setS(r);
    if (r.state !== "running") return;
    timer.current = setInterval(async () => {
      const p = (await fetch("/api/brief").then((x) => x.json()).catch(() => null)) as S | null;
      if (!p || p.state === "running") return;
      clearInterval(timer.current); setS(p); router.refresh();
    }, 3000);
  }
  const running = s.state === "running";
  return (
    <div className="flex flex-col items-start gap-2.5">
      <button type="button" onClick={go} disabled={!enabled || running} className={clsx(btn.base, btn.primary)}>
        {running ? <CircleNotch size={20} className="animate-spin" /> : <Sparkle size={20} weight="fill" />}
        {running ? "Writing brief…" : "Write brief"}
      </button>
      <p role="status" className="t-meta">
        {!enabled ? "Needs the local pipeline folder (DISCOVERY_DIR)." : running ? "Up to a minute." : s.state === "failed" ? `Could not write the brief. ${s.error ?? "It needs the model key in the pipeline's .env."}` : s.state === "unavailable" ? s.error : ""}
      </p>
    </div>
  );
}

"use client";
import { useState } from "react";
import { LockKey } from "@phosphor-icons/react";
import clsx from "clsx";
import { Sheet } from "./sheet";
import { btn, ErrorNote } from "./ui";
import { toast } from "@/lib/toast";
import { unlock, type ActionResult } from "@/app/assets/actions";

const OFFLINE: ActionResult = { ok: false, error: "Could not reach the server. Nothing was changed." };

/** Runs an Asset Studio action. If the server asks for the passcode, opens the unlock sheet and retries once unlocked. */
export function useAssetAction() {
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  async function run(act: () => Promise<ActionResult>, onOk?: (r: Extract<ActionResult, { ok: true }>) => void): Promise<boolean> {
    setPending(true);
    const r = await act().catch(() => OFFLINE);
    setPending(false);
    if (r.ok) { onOk?.(r); return true; }
    if (r.locked) { setRetry(() => () => void run(act, onOk)); return false; }
    toast(r.error, { kind: "error" });
    return false;
  }

  const sheet = <UnlockSheet open={!!retry} onClose={() => setRetry(null)} onUnlocked={() => { const again = retry; setRetry(null); again?.(); }} />;
  return { run, pending, sheet };
}

function UnlockSheet({ open, onClose, onUnlocked }: { open: boolean; onClose: () => void; onUnlocked: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(form: FormData) {
    setBusy(true); setError(null);
    const r = await unlock(form.get("passcode")).catch(() => OFFLINE);
    setBusy(false);
    if (r.ok) onUnlocked(); else setError(r.error);
  }
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { setError(null); onClose(); } }} title="Unlock changes">
      <form action={submit} className="space-y-4 pt-2">
        <p className="t-body text-muted">Asset projects change real data. Enter the studio passcode once on this device.</p>
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-medium">Studio passcode</span>
          <input name="passcode" type="password" required autoComplete="current-password" autoFocus aria-invalid={!!error} aria-describedby={error ? "pass-err" : undefined}
            className="h-12 w-full rounded-ctl border border-line bg-raised px-4 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-accent" />
        </label>
        {error && <div id="pass-err"><ErrorNote what={error} /></div>}
        <button type="submit" disabled={busy} className={clsx(btn.base, btn.primary, "w-full")}><LockKey size={18} weight="bold" aria-hidden />{busy ? "Checking…" : "Unlock"}</button>
      </form>
    </Sheet>
  );
}

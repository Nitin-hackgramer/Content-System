"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { dismissToast, toast } from "@/lib/toast";

export type Mode = "ok" | "local" | "unreachable" | "error";

const online = () => (typeof navigator === "undefined" ? true : navigator.onLine);
const subNet = (cb: () => void) => { addEventListener("online", cb); addEventListener("offline", cb); return () => { removeEventListener("online", cb); removeEventListener("offline", cb); }; };
const was = (k: string) => { try { return sessionStorage.getItem("notice." + k) === "1"; } catch { return false; } };

const COPY = {
  offline: { kind: "warning", title: "You're offline", detail: "Changes save on this device only." },
  local: { kind: "info", title: "Local mode", detail: "Ideas load from this device. Saves stay here." },
  unreachable: { kind: "warning", title: "Database unreachable", detail: "Showing the local copy. Saves stay on this device." },
  error: { kind: "error", title: "Nothing could be loaded", detail: "Neither the database nor a local copy answered." },
} as const;

/** Renders nothing: connectivity is reported as one toast (id "conn") with a Retry. Offline (this device) is told apart from a
 *  database problem. It stays until dismissed or fixed, remembers a manual dismissal for the session, and when the database
 *  answers again, saves made meanwhile are pushed up and the result is reported. */
export function Connectivity({ mode }: { mode: Mode }) {
  const router = useRouter();
  const net = useSyncExternalStore(subNet, online, () => true);
  const kind = !net ? "offline" : mode === "ok" ? null : mode;

  useEffect(() => {
    if (!kind) { dismissToast("conn"); return; }
    if (was(kind)) return;
    const c = COPY[kind];
    toast(c.title, { id: "conn", kind: c.kind, detail: c.detail, persist: true, action: { label: "Retry", run: () => router.refresh() },
      onClose: () => { try { sessionStorage.setItem("notice." + kind, "1"); } catch {} } });
  }, [kind, router]);

  useEffect(() => {
    if (mode !== "ok" || !net) return;
    fetch("/api/sync", { method: "POST" }).then((r) => (r.ok ? r.json() : null)).then((r) => {
      if (r?.synced) { toast(`Synced ${r.synced} ${r.synced === 1 ? "change" : "changes"} to the database`, { detail: "They were saved on this device first." }); router.refresh(); }
    }).catch(() => {});
  }, [mode, net, router]);

  const prev = useRef(net);
  useEffect(() => { // back online: re-check what the server can reach
    if (net && !prev.current) { toast("Back online", { kind: "info", detail: "Checking the database…" }); router.refresh(); }
    prev.current = net;
  }, [net, router]);
  return null;
}

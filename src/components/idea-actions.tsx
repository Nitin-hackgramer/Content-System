"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkSimple, Star, Archive } from "@phosphor-icons/react";
import clsx from "clsx";
import { toast } from "@/lib/toast";
import type { IdeaStatus } from "@/lib/types";

const ACTIONS: { status: IdeaStatus; label: string; done: string; Icon: typeof Star }[] = [
  { status: "saved", label: "Save", done: "Saved to your library", Icon: BookmarkSimple },
  { status: "shortlisted", label: "Shortlist", done: "Added to shortlist", Icon: Star },
  { status: "archived", label: "Archive", done: "Archived", Icon: Archive },
];

/** Save / shortlist / archive. Tapping the active one clears it. Persisted via /api/idea-state. */
export function IdeaActions({ id, status, compact, labels }: { id: string; status?: IdeaStatus; compact?: boolean; labels?: boolean }) {
  const router = useRouter();
  const [cur, setCur] = useState<IdeaStatus | undefined>(status);
  const [, start] = useTransition();

  async function set(next: IdeaStatus, done: string) {
    const target = cur === next ? undefined : next;
    const prev = cur;
    setCur(target);
    const res = await fetch("/api/idea-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: target ?? null }) }).catch(() => null);
    if (!res?.ok) { setCur(prev); toast("Could not save", { kind: "error", detail: "Nothing was changed. Try again." }); return; }
    const j = (await res.json().catch(() => null)) as { where?: string } | null;
    // never imply cloud persistence that did not happen
    if (j?.where === "local") toast("Saved on this device only", { kind: "warning", detail: "It syncs when the database is reachable." });
    else toast(target ? done : "Removed");
    start(() => router.refresh());
  }

  const list = compact ? ACTIONS.slice(0, 2) : ACTIONS;
  return (
    <div className="flex gap-2" role="group" aria-label="Idea actions">
      {list.map(({ status: s, label, done, Icon }) => {
        const on = cur === s;
        return (
          <button key={s} type="button" aria-pressed={on} aria-label={label} data-ia="pop" onClick={() => set(s, done)}
            className={clsx("inline-flex items-center justify-center gap-2 rounded-ctl text-[15px] font-medium transition-[transform,background-color] duration-150 active:scale-[0.95]",
              labels ? "h-12 flex-1 px-3" : "size-11", on ? "bg-ink text-bg" : "bg-surface text-ink hover:bg-linen-deep")}>
            <Icon size={20} weight={on ? "fill" : "regular"} />
            {labels && label}
          </button>
        );
      })}
    </div>
  );
}

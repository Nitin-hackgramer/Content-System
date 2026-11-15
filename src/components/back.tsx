"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import clsx from "clsx";

/** Goes back through browser history when this session has an earlier in-app page (so scroll position and the
 *  Library's search and filters come back), otherwise to a sensible parent. The shell counts in-app navigations. */
export function goBack(router: ReturnType<typeof useRouter>, fallback: string) {
  let depth = 0;
  try { depth = Number(sessionStorage.getItem("studio.depth")) || 0; } catch {}
  if (depth > 1) router.back(); else router.push(fallback);
}
export function BackButton({ fallback, label = "Back", className }: { fallback: string; label?: string; className?: string }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => goBack(router, fallback)} aria-label={label} data-ia="nudgeBack"
      className={clsx("grid size-11 shrink-0 place-items-center rounded-full bg-paper text-ink shadow-card ring-1 ring-line/60 hit press relative transition-shadow hover:shadow-lift", className)}>
      <ArrowLeft size={22} weight="bold" aria-hidden />
    </button>
  );
}

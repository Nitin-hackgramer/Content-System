"use client";
import { ErrorNote, btn } from "@/components/ui";
import clsx from "clsx";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-10">
      <ErrorNote what="This page could not load." detail="Your data is untouched." />
      <button onClick={reset} className={clsx(btn.base, btn.quiet, "mt-4")}>Try again</button>
    </div>
  );
}

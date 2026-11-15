"use client";
import clsx from "clsx";
import { Cover } from "./cover";

/** The idea's own story image over its cover art. The cover is the fallback: no image, slow image or blocked image all look intentional.
 *  Fade-in is plain DOM (no state) so cached images that loaded before hydration still show. */
export function Photo({ id, priority, className }: { id: string; priority?: boolean; className?: string }) {
  return (
    <div data-photo className={clsx("relative h-full w-full overflow-hidden", className)}>
      <Cover id={id} />
      {/* eslint-disable-next-line @next/next/no-img-element -- remote publisher image behind a redirect, sized by its box */}
      <img src={`/api/photo/${id}`} alt="" loading={priority ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer"
        ref={(el) => { if (el?.complete && el.naturalWidth) el.style.opacity = "1"; }}
        onLoad={(e) => { e.currentTarget.style.opacity = "1"; }}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
        style={{ opacity: 0 }} className="absolute inset-0 size-full object-cover transition-opacity duration-500" />
    </div>
  );
}

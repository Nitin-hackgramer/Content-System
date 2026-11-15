"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MotionConfig, motion } from "motion/react";
import { House, Compass, BookmarksSimple, SquaresFour, SidebarSimple, TrendUp, ClockCounterClockwise, Broadcast, GearSix } from "@phosphor-icons/react";
import clsx from "clsx";
import { Connectivity, type Mode } from "./notice";
import { Toaster } from "./toaster";
import { IconMotion } from "./icon-motion";
import { MorphCapture } from "./morph";

const MAIN = [
  { href: "/", label: "Home", Icon: House },
  { href: "/discover", label: "Discover", Icon: Compass },
  { href: "/library", label: "Library", Icon: BookmarksSimple },
  { href: "/more", label: "More", Icon: SquaresFour },
];
const MORE = [
  { href: "/trends", label: "Trends", Icon: TrendUp },
  { href: "/history", label: "History", Icon: ClockCounterClockwise },
  { href: "/sources", label: "Sources", Icon: Broadcast },
  { href: "/settings", label: "Settings", Icon: GearSix },
];
const MORE_PATHS = MORE.map((m) => m.href);
const active = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

export function Shell({ children, mode }: { children: React.ReactNode; mode: Mode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => { const on = () => setScrolled(window.scrollY > 12); on(); window.addEventListener("scroll", on, { passive: true }); return () => window.removeEventListener("scroll", on); }, []);
  useEffect(() => { try { sessionStorage.setItem("studio.depth", String((Number(sessionStorage.getItem("studio.depth")) || 0) + 1)); } catch {} }, [path]); // in-app page count, read by <BackButton>
  const detail = /^\/library\/[^/]+/.test(path); // full-screen on mobile: the page owns its own back bar and action bar
  const isMain = (href: string) => active(path, href) || (href === "/more" && MORE_PATHS.some((p) => active(path, p)));

  return (
    <MotionConfig reducedMotion="user">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-ctl focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className={clsx("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-bg py-6 transition-[width] duration-200 lg:flex", collapsed ? "w-[72px] px-3" : "w-[248px] px-4")}>
        <div className="mb-8 flex items-center justify-between px-2">
          {!collapsed && <span className="text-[1.25rem] font-medium tracking-[-0.02em]">Creator Studio</span>}
          <button onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="grid size-11 place-items-center rounded-ctl text-muted hover:bg-surface">
            <SidebarSimple size={20} />
          </button>
        </div>
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-1">
          {[...MAIN.slice(0, 3), ...MORE].map(({ href, label, Icon }) => {
            const on = active(path, href);
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined} title={label} data-ia="pop"
                className={clsx("flex h-12 items-center gap-3 rounded-ctl px-3 text-[15px] transition-colors", on ? "bg-accent-soft font-medium text-accent-deep" : "text-muted hover:bg-surface hover:text-ink")}>
                <Icon size={22} weight={on ? "fill" : "regular"} />
                {!collapsed && label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile top bar: translucent; its hairline only appears once content has scrolled under it */}
      {!detail && (
        <header data-scrolled={scrolled} className="bar-top bar-glass fixed inset-x-0 top-0 z-30 flex h-[calc(env(safe-area-inset-top)+44px)] items-end justify-center bg-bg/70 pb-2.5 backdrop-blur-2xl backdrop-saturate-[1.8] lg:hidden">
          <span className="text-[15px] font-medium tracking-[-0.01em]">Creator Studio</span>
        </header>
      )}
      <div className={clsx("transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-[248px]")}>
        <main id="main" className={clsx("mx-auto w-full max-w-[1100px] px-4 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10", detail ? "pt-5" : "pt-[calc(env(safe-area-inset-top)+60px)]", detail ? "pb-[calc(104px+var(--safe-b))]" : "pb-[calc(var(--nav-h)+var(--safe-b)+44px)]")}>
          <Connectivity mode={mode} />
          {children}
        </main>
      </div>

      <Toaster />
      <IconMotion />
      <MorphCapture />

      {/* Mobile bottom navigation: opaque, 72px, active pill slides between tabs */}
      {!detail && (
        <>
        <div aria-hidden className="fade-bottom pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(var(--nav-h)+var(--safe-b)+40px)] lg:hidden" /><nav aria-label="Primary" className="dock fixed inset-x-4 bottom-[calc(12px+var(--safe-b))] z-30 mx-auto max-w-md rounded-[28px] lg:hidden">
          <ul className="mx-auto grid h-[var(--nav-h)] grid-cols-4 px-2">
            {MAIN.map(({ href, label, Icon }) => {
              const on = isMain(href);
              return (
                <li key={href}>
                  <Link href={href} aria-current={on ? "page" : undefined} data-ia="pop" className={clsx("press flex h-full flex-col items-center justify-center gap-1 text-[12px] font-medium", on ? "text-accent-deep" : "text-muted")}>
                    <span className="relative grid h-8 w-14 place-items-center">
                      {on && <motion.span layoutId="nav-pill" transition={{ type: "spring", stiffness: 500, damping: 36 }} className="absolute inset-0 rounded-full bg-accent-soft" />}
                      <Icon size={24} weight={on ? "fill" : "regular"} className="relative" />
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        </>
      )}
    </MotionConfig>
  );
}

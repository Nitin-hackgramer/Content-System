"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";

/** Bottom sheet on phones, right-hand drawer on desktop. Radix handles focus trap, Escape and aria. */
export function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-40 bg-ink/50" />
        <Dialog.Content aria-describedby={undefined}
          className="sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-[28px] bg-paper shadow-[var(--shadow-sheet)] lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[420px] lg:rounded-none lg:rounded-l-[28px]">
          <div className="mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-linen-deep lg:hidden" aria-hidden />
          <div className="flex items-center justify-between px-5 pb-1 pt-3 sm:px-6">
            <Dialog.Title className="t-title">{title}</Dialog.Title>
            <Dialog.Close aria-label="Close" className="grid size-11 place-items-center rounded-full bg-surface text-ink hover:bg-linen-deep"><X size={18} weight="bold" /></Dialog.Close>
          </div>
          <div className="overflow-y-auto overscroll-contain px-5 pb-[calc(20px+var(--safe-b))] sm:px-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

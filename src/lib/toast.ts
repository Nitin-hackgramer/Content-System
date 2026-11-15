// A tiny external store: any client code calls toast(); <Toaster/> (in the shell) renders the queue.
export type ToastKind = "success" | "info" | "warning" | "error";
export type ToastItem = {
  id: string; kind: ToastKind; text: string; detail?: string;
  persist?: boolean; // stays until dismissed: use with an action, so the person always has a way forward
  action?: { label: string; run: () => void };
  onClose?: () => void; // only on a manual dismiss
};

let items: ToastItem[] = [];
const subs = new Set<() => void>();
const set = (next: ToastItem[]) => { items = next; subs.forEach((f) => f()); };

export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const getToasts = () => items;

/** Same id replaces the earlier toast, so a status never stacks up on itself. */
export function toast(text: string, o: Partial<Omit<ToastItem, "text">> = {}) {
  const id = o.id ?? `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const t: ToastItem = { kind: "success", ...o, id, text };
  set(items.some((x) => x.id === id) ? items.map((x) => (x.id === id ? t : x)) : [...items, t]);
  return id;
}
export const dismissToast = (id: string, manual = false) => {
  const t = items.find((x) => x.id === id);
  if (!t) return;
  set(items.filter((x) => x.id !== id));
  if (manual) t.onClose?.();
};

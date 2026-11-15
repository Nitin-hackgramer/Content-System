// Shared-element hand-off between a tapped card and the idea page: the card records where its photo was, the page reads it once.
export type Morph = { id: string; x: number; y: number; w: number; h: number; src: string; radius: number; at: number };
let m: Morph | null = null;
let o: { x: number; y: number; at: number } | null = null;
export const setOrigin = (x: number, y: number) => { o = { x, y, at: Date.now() }; };
/** Peek, not take: React dev double-renders. Expires fast so only the page opened by that tap uses it. */
export const peekOrigin = (now = Date.now()) => (o && now - o.at < 1500 ? o : null);
export const setMorph = (v: Morph) => { m = v; };
/** One-shot and short-lived: a stale record (direct visit, back/forward) must never animate. */
export const takeMorph = (id: string, now = Date.now()) => { const v = m; m = null; return v && v.id === id && now - v.at < 3000 ? v : null; };

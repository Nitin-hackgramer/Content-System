import "server-only";
import { lookup } from "node:dns/promises";
import { isPrivateIp } from "./net";

// Link-preview image of a story page (its og:image), the same thing a chat app shows for a pasted link.
// The image is the publisher's, shown with the story it belongs to, never re-hosted.
// Safe to face the internet: every hop (redirects included) must resolve only to public addresses, and at most
// MAX_BYTES of HTML is read. ponytail: DNS is checked, then fetch resolves again (tiny rebinding window); pin the IP with
// a custom agent if this ever fetches anything more sensitive than a public page's <head>.
const memo = new Map<string, { img: string | null; at: number }>();
const MAX_BYTES = 250_000, MAX_HOPS = 3;

async function publicUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:") return null;
  try {
    const addrs = await lookup(u.hostname.replace(/^\[|\]$/g, ""), { all: true });
    return addrs.length && addrs.every((a) => !isPrivateIp(a.address)) ? u : null;
  } catch { return null; }
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let n = 0;
  while (n < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); n += value.length;
  }
  void reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

async function fetchHtml(start: string): Promise<{ html: string; url: string } | null> {
  let next = start;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const u = await publicUrl(next);
    if (!u) return null;
    const r = await fetch(u, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(3500), headers: { "user-agent": "Mozilla/5.0 (compatible; CreatorStudioPreview/1.0)", accept: "text/html" } });
    const loc = r.headers.get("location");
    if (r.status >= 300 && r.status < 400 && loc) { next = new URL(loc, u).href; continue; }
    if (!r.ok || !/html/i.test(r.headers.get("content-type") ?? "")) return null;
    return { html: await readCapped(r), url: u.href };
  }
  return null;
}

export async function ogImage(page: string): Promise<string | null> {
  const hit = memo.get(page);
  if (hit && Date.now() - hit.at < 6 * 36e5) return hit.img;
  let img: string | null = null;
  try {
    const got = await fetchHtml(page);
    for (const tag of got?.html.match(/<meta\b[^>]*>/gi) ?? []) {
      if (!/(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["']/i.test(tag)) continue;
      const c = tag.match(/content=["']([^"']+)["']/i)?.[1];
      if (!c) continue;
      const abs = new URL(c.replace(/&amp;/g, "&"), got!.url);
      if (abs.protocol === "https:") { img = abs.href; break; }
    }
  } catch { /* timeout, blocked, bad HTML: no image, the cover art stands in */ }
  memo.set(page, { img, at: Date.now() });
  return img;
}

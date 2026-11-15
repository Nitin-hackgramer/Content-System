import "server-only";

// Link-preview image of a story page (its og:image), the same thing a chat app shows for a pasted link.
// The image is the publisher's, shown with the story it belongs to, never re-hosted.
// ponytail: blocks private hostnames by name only; no DNS pinning, no body size cap. Add both before this faces the internet.
const memo = new Map<string, { img: string | null; at: number }>();
const PRIVATE = /^(localhost|.*\.(local|internal|localdomain)|\d{1,3}(\.\d{1,3}){3}|\[.*\])$/i;

export async function ogImage(page: string): Promise<string | null> {
  let u: URL;
  try { u = new URL(page); } catch { return null; }
  if (u.protocol !== "https:" || PRIVATE.test(u.hostname)) return null;
  const hit = memo.get(u.href);
  if (hit && Date.now() - hit.at < 6 * 36e5) return hit.img;
  let img: string | null = null;
  try {
    const r = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(3500), headers: { "user-agent": "Mozilla/5.0 (compatible; CreatorStudioPreview/1.0)", accept: "text/html" } });
    if (r.ok && /html/i.test(r.headers.get("content-type") ?? "")) {
      const head = (await r.text()).slice(0, 250_000);
      for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
        if (!/(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["']/i.test(tag)) continue;
        const c = tag.match(/content=["']([^"']+)["']/i)?.[1];
        if (!c) continue;
        const abs = new URL(c.replace(/&amp;/g, "&"), r.url);
        if (abs.protocol === "https:") { img = abs.href; break; }
      }
    }
  } catch { /* timeout, blocked, bad HTML: no image, the cover art stands in */ }
  memo.set(u.href, { img, at: Date.now() });
  return img;
}

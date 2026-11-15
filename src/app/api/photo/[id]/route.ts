import { getIdeas } from "@/lib/data";
import { ogImage } from "@/lib/og";
import type { Idea } from "@/lib/types";

// Redirects to the preview image of the idea's own story links, or 404 so the client keeps its cover art.
let snap: { at: number; ideas: Idea[] } | null = null;
const ideas = async () => {
  if (snap && Date.now() - snap.at < 60_000) return snap.ideas;
  const r = await getIdeas();
  if (!r.ok) return snap?.ideas ?? [];
  snap = { at: Date.now(), ideas: r.data.ideas };
  return snap.ideas;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{8,64}$/i.test(id)) return new Response(null, { status: 400 });
  const idea = (await ideas()).find((i) => i.id === id);
  const urls = [...new Set([...(idea?.evidence ?? []).map((e) => e.url), idea?.url].filter((u): u is string => !!u))].slice(0, 3);
  const found = (await Promise.all(urls.map(ogImage))).find(Boolean);
  if (found) return new Response(null, { status: 302, headers: { Location: found, "Cache-Control": "public, max-age=86400" } });
  return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
}

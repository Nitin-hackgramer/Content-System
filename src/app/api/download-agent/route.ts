import { handle } from "@/lib/download-agent";

// The laptop downloader's bridge (see lib/download-agent.ts). POST only, DOWNLOAD_AGENT_SECRET bearer, six fixed operations.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const r = await handle(req.headers.get("authorization"), body);
  return Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
}

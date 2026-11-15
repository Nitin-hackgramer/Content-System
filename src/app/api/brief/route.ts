import { NextResponse } from "next/server";
import { start, status } from "@/lib/py";

export const dynamic = "force-dynamic";

const ID = /^[a-f0-9]{8,64}$/i;
const reply = (s: Awaited<ReturnType<typeof status>>) => NextResponse.json(s, { status: s.state === "unavailable" ? 501 : 200 });

export const GET = async () => reply(await status("brief"));

export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id || !ID.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  return reply(await start("brief", { id }));
}

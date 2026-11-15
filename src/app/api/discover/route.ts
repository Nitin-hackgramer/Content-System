import { NextResponse } from "next/server";
import { start, status } from "@/lib/py";

export const dynamic = "force-dynamic";

const reply = (s: Awaited<ReturnType<typeof status>>) => NextResponse.json(s, { status: s.state === "unavailable" ? 501 : 200 });

export const GET = async () => reply(await status("discover"));
export const POST = async () => reply(await start("discover"));

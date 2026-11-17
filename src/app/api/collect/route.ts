import { NextResponse } from "next/server";
import { passcodeOk } from "@/lib/access";
import { runCollector } from "@/lib/collector";
import { providers } from "@/lib/providers";

// Worker entry point. A scheduler (Hostinger cron, GitHub Actions or Vercel Cron) calls it; it claims waiting jobs in the
// database, so overlapping calls never process the same job. Guarded by TRIGGER_SECRET (32+ chars), the same secret the
// discovery pipeline uses: unset or short = closed. Not reachable from the browser UI.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: Request) {
  const key = process.env.TRIGGER_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
  if (!key || key.length < 32 || !passcodeOk(given, key)) return new NextResponse(null, { status: 401 });
  try { return NextResponse.json(await runCollector(providers)); }
  catch { return NextResponse.json({ error: "collector failed" }, { status: 502 }); } // detail stays in the server log, never the response
}
export const GET = run, POST = run;

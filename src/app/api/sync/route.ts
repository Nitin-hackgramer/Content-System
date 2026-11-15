import { NextResponse } from "next/server";
import { syncLocalState } from "@/lib/data";

export async function POST() {
  try { return NextResponse.json(await syncLocalState()); } catch { return NextResponse.json({ synced: 0, error: "database unreachable" }, { status: 502 }); }
}

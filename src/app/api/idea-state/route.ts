import { NextResponse } from "next/server";
import { setIdeaStatus } from "@/lib/data";

const ID = /^[a-f0-9]{8,64}$/i;
const STATUSES = ["saved", "shortlisted", "archived", null];

export async function POST(req: Request) {
  const { id, status } = (await req.json().catch(() => ({}))) as { id?: string; status?: string | null };
  if (!id || !ID.test(id) || status === undefined || !STATUSES.includes(status)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    const r = await setIdeaStatus(id, status as never);
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ error: "could not save" }, { status: 502 });
  }
}

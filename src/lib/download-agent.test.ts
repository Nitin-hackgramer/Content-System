// Run with --conditions=react-server (see package.json "test"). The laptop bridge against a stand-in PostgREST.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { handle } from "./download-agent.ts";

const SECRET = "d".repeat(40);
type Call = { fn: string; body: Record<string, unknown> | undefined; params: URLSearchParams };
let calls: Call[] = [], answers: { status: number; body?: unknown }[] = [];
beforeEach(() => {
  calls = []; answers = [];
  Object.assign(process.env, { SUPABASE_URL: "https://db.test", SUPABASE_SECRET_KEY: "service", DOWNLOAD_AGENT_SECRET: SECRET, STUDIO_KEY: "s".repeat(40), TRIGGER_SECRET: "t".repeat(40) });
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const u = new URL(String(input));
    calls.push({ fn: u.pathname.replace("/rest/v1/", "").replace("rpc/", ""), body: init?.body ? JSON.parse(String(init.body)) : undefined, params: u.searchParams });
    const a = answers.shift() ?? { status: 200, body: [] };
    return new Response(a.body === undefined ? null : JSON.stringify(a.body), { status: a.status });
  }) as typeof fetch;
});
const reply = (...a: { status: number; body?: unknown }[]) => answers.push(...a);
const auth = `Bearer ${SECRET}`;
const JOB = "8b0e6d1a-1111-4c1c-9a7e-1d2c3b4a5f60", TOKEN = "1b0e6d1a-2222-4c1c-9a7e-1d2c3b4a5f60", SEL = "2b0e6d1a-3333-4c1c-9a7e-1d2c3b4a5f60";
const held = { job: JOB, token: TOKEN };

// ---- who may call ----
test("missing, wrong, studio or trigger credentials are refused before any database call", async () => {
  for (const h of [null, "", "Bearer", `Bearer ${"x".repeat(40)}`, SECRET, `Bearer ${process.env.STUDIO_KEY}`, `Bearer ${process.env.TRIGGER_SECRET}`]) {
    const r = await handle(h, { op: "claim", agent: "laptop" });
    assert.equal(r.status, 401, String(h));
  }
  assert.deepEqual(calls, []);
});
test("an unset or short secret closes the door", async () => {
  for (const v of [undefined, "short"]) {
    if (v === undefined) delete process.env.DOWNLOAD_AGENT_SECRET; else process.env.DOWNLOAD_AGENT_SECRET = v;
    assert.equal((await handle(`Bearer ${v ?? ""}`, { op: "claim", agent: "x" })).status, 401);
  }
});
test("only the six download operations exist; nothing like finalize or reopen", async () => {
  for (const op of ["finalize", "reopen", "retry", "select", "query", "rpc", "", undefined]) assert.equal((await handle(auth, { op, ...held })).status, 400, String(op));
  assert.equal((await handle(auth, null)).status, 400);
  assert.equal((await handle(auth, [1])).status, 400);
  assert.deepEqual(calls, []);
});

// ---- claim ----
test("claim: atomic claim, folder reserved with the laptop's minimum, kept assets joined; no token for anything else", async () => {
  reply({ status: 200, body: [{ id: JOB, idea_id: "abc", title: "T", idea: { hook: "h" }, revision: 0, claim_token: TOKEN, attempt_count: 1, max_attempts: 3, folder_number: null, owner_id: "secret-owner" }] },
    { status: 200, body: 4 },
    { status: 200, body: [{ id: SEL, download_status: "pending", local_path: null, attempts: 0, candidate: { asset_type: "image", name: "a", source_name: "s", source_url: "https://s/1", download_url: "https://d/1" } }] });
  const r = await handle(auth, { op: "claim", agent: "omen-laptop", min_folder: 4 });
  assert.equal(r.status, 200);
  assert.deepEqual(calls.map((c) => c.fn), ["claim_asset_job", "reserve_asset_folder", "asset_selections"]);
  assert.deepEqual(calls[0].body, { p_agent: "omen-laptop", p_lease_seconds: 900 });
  assert.deepEqual(calls[1].body, { p_job: JOB, p_token: TOKEN, p_min: 4 });
  assert.equal(calls[2].params.get("job_id"), `eq.${JOB}`);
  const b = r.body as { job: Record<string, unknown>; assets: Record<string, unknown>[] };
  assert.equal(b.job.folder_number, 4);
  assert.ok(!("owner_id" in b.job));
  assert.deepEqual(b.assets[0], { selection_id: SEL, download_status: "pending", local_path: null, attempts: 0, asset_type: "image", name: "a", source_name: "s", source_url: "https://s/1", download_url: "https://d/1" });
});
test("claim with nothing pending answers job null", async () => {
  reply({ status: 200, body: [] });
  assert.deepEqual((await handle(auth, { op: "claim", agent: "laptop" })).body, { job: null });
});
test("claim validates the agent name and the folder minimum", async () => {
  for (const b of [{ agent: "" }, { agent: "../x" }, { agent: "a".repeat(65) }, { agent: "ok", min_folder: 0 }, { agent: "ok", min_folder: 1.5 }, { agent: "ok", min_folder: "3" }])
    assert.equal((await handle(auth, { op: "claim", ...b })).status, 400, JSON.stringify(b));
  assert.deepEqual(calls, []);
});

// ---- after the claim ----
test("every later operation needs a job id and its token", async () => {
  for (const op of ["heartbeat", "record", "complete", "fail"]) {
    assert.equal((await handle(auth, { op, job: JOB })).status, 400);
    assert.equal((await handle(auth, { op, job: "x", token: TOKEN })).status, 400);
  }
  assert.deepEqual(calls, []);
});
test("record maps to record_asset_download and only accepts a path inside a Video folder", async () => {
  reply({ status: 200, body: {} });
  const ok = await handle(auth, { op: "record", ...held, selection: SEL, status: "done", local_path: "Video 04/assets/images/robot arm.jpg" });
  assert.equal(ok.status, 200);
  assert.deepEqual(calls[0].body, { p_job: JOB, p_token: TOKEN, p_selection: SEL, p_status: "done", p_local_path: "Video 04/assets/images/robot arm.jpg", p_error: null });
  for (const p of ["C:/Users/x/a.jpg", "../Video 04/assets/images/a.jpg", "Video 04/assets/images/../../x", "Video 04/assets/other/a.jpg", "Video 04/assets/images/a/b.jpg", "Video 04\\assets\\images\\a.jpg"])
    assert.equal((await handle(auth, { op: "record", ...held, selection: SEL, status: "done", local_path: p })).status, 400, p);
  for (const s of ["completed", "", 3]) assert.equal((await handle(auth, { op: "record", ...held, selection: SEL, status: s })).status, 400);
  assert.equal((await handle(auth, { op: "record", ...held, selection: SEL, status: "done" })).status, 400);
});
test("errors sent by the laptop are stored without URLs", async () => {
  reply({ status: 200, body: {} }, { status: 200, body: { status: "retry" } });
  await handle(auth, { op: "record", ...held, selection: SEL, status: "failed", error: "403 at https://cdn.x/a.jpg?sig=SECRET" });
  await handle(auth, { op: "fail", ...held, error: "x https://cdn.x/?token=SECRET" });
  assert.ok(!JSON.stringify(calls.map((c) => c.body)).includes("SECRET"));
});
test("heartbeat validates progress and extends the lease", async () => {
  reply({ status: 200, body: {} });
  assert.equal((await handle(auth, { op: "heartbeat", ...held, progress: 40 })).status, 200);
  assert.deepEqual(calls[0].body, { p_job: JOB, p_token: TOKEN, p_progress: 40, p_lease_seconds: 900 });
  for (const p of [-1, 101, "50"]) assert.equal((await handle(auth, { op: "heartbeat", ...held, progress: p })).status, 400);
});
test("complete never sends a folder number, so the reserved one is kept", async () => {
  reply({ status: 200, body: { status: "completed", folder_number: 4 } });
  const r = await handle(auth, { op: "complete", ...held, folder_number: 99 });
  assert.deepEqual(calls[0].body, { p_job: JOB, p_token: TOKEN, p_folder_number: null });
  assert.deepEqual(r.body, { ok: true, status: "completed", folder_number: 4 });
});
test("a lost claim or unfinished assets come back as 409 with the database's reason; other failures stay opaque", async () => {
  reply({ status: 400, body: { code: "P0001", message: "claim is no longer held for asset job x" } }, { status: 500, body: { code: "XX000", message: "internal detail" } });
  assert.deepEqual(await handle(auth, { op: "complete", ...held }), { status: 409, body: { error: "claim is no longer held for asset job x" } });
  assert.deepEqual(await handle(auth, { op: "complete", ...held }), { status: 502, body: { error: "database unavailable" } });
});

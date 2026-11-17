// Run with --conditions=react-server (see package.json "test"). Real collector code against a stand-in PostgREST.
import type { IdeaSnapshot } from "./asset-status.ts";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { claimCollection, clean, finishCollection, parseCandidate, validate, MAX_CANDIDATES, type AssetProvider } from "./collector.ts";

type Call = { fn: string; body: Record<string, unknown>; params: URLSearchParams };
let calls: Call[] = [], answers: { status: number; body?: unknown }[] = [];
beforeEach(() => {
  calls = []; answers = [];
  process.env.SUPABASE_URL = "https://db.test"; process.env.SUPABASE_SECRET_KEY = "secret";
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const u = new URL(String(input));
    calls.push({ fn: u.pathname.replace("/rest/v1/", "").replace("rpc/", ""), body: JSON.parse(String(init?.body ?? "{}")), params: u.searchParams });
    const a = answers.shift() ?? { status: 200, body: [] };
    return new Response(a.body === undefined ? null : JSON.stringify(a.body), { status: a.status });
  }) as typeof fetch;
});
const reply = (...a: { status: number; body?: unknown }[]) => answers.push(...a);
const JOB = { id: "8b0e6d1a-1111-4c1c-9a7e-1d2c3b4a5f60", idea_id: "4365b119889f", title: "Robots cook", idea: { title: "Robots cook" } as unknown as IdeaSnapshot, collect_token: "tok-1", collect_attempts: 1 };
const claimed = (j = JOB) => ({ status: 200, body: [j] });
const none = { status: 200, body: [] };
const ok = { status: 200, body: {} };
const held = { status: 400, body: { code: "P0001", message: "collection claim is no longer held for asset job x" } };
const quiet = { log: () => {} };
const good = (n: number) => ({ asset_type: "image", source_url: `https://src.example/${n}`, download_url: `https://cdn.example/${n}.jpg` });
const provider = (name: string, r: AssetProvider["collect"]): AssetProvider => ({ name, collect: r });
const found = (...c: unknown[]) => provider("p", async () => ({ ok: true, candidates: c }));
const names = () => calls.map((c) => c.fn);

// ---- validation ----
test("a candidate needs a type and an http(s) source link; unknown fields are dropped", () => {
  assert.deepEqual(parseCandidate({ ...good(1), evil: "x", asset_type: " Image " }), { asset_type: "image", source_url: "https://src.example/1", download_url: "https://cdn.example/1.jpg" });
  for (const bad of [null, [], "x", { source_url: "https://a/1" }, { asset_type: "image" }, { asset_type: "image", source_url: "ftp://a/1" },
    { asset_type: "image", source_url: "javascript:alert(1)" }, { ...good(1), download_url: "data:text/html,x" }, { ...good(1), preview_url: "nope" },
    { ...good(1), download_url_expires_at: "yesterday-ish" }, { ...good(1), metadata: [1] }, { ...good(1), metadata: { big: "x".repeat(9000) } }])
    assert.equal(parseCandidate(bad), null);
});
test("validate drops invalid and duplicate sources and caps the batch", () => {
  const r = validate([good(1), good(1), { nope: 1 }, good(2)]);
  assert.deepEqual([r.valid.length, r.rejected], [2, 2]);
  assert.equal(validate(Array.from({ length: MAX_CANDIDATES + 5 }, (_, i) => good(i))).valid.length, MAX_CANDIDATES);
});
test("stored errors carry no URLs and stay short", () => {
  const m = clean(new Error("GET https://api.example/x?sig=SECRET failed"));
  assert.ok(!m.includes("SECRET") && m.includes("[url]"));
  assert.ok(clean("y".repeat(900)).length <= 200);
});

// ---- tapping Collect: claiming exactly one job ----
const state = (o: Partial<{ status: string; collect_attempts: number; collect_max_attempts: number; collect_token: string | null; collect_lease_expires_at: string | null }>) =>
  ({ status: 200, body: [{ status: "collecting", collect_attempts: 1, collect_max_attempts: 3, collect_token: null, collect_lease_expires_at: null, ...o }] });
const future = () => new Date(Date.now() + 60_000).toISOString();

test("no provider: nothing is claimed and the database is not touched", async () => {
  assert.deepEqual(await claimCollection(JOB.id, []), { state: "no_provider" });
  assert.deepEqual(calls, []);
});
test("the claim names exactly the requested job", async () => {
  reply(claimed());
  const r = await claimCollection(JOB.id, [found(good(1))]);
  assert.equal(r.state, "started");
  assert.deepEqual([calls.length, calls[0].fn, calls[0].body.p_job], [1, "claim_collect_job", JOB.id]);
});
test("a duplicate tap while a collection runs reports running and changes nothing", async () => {
  reply(none, state({ collect_token: "tok-live", collect_lease_expires_at: future() }));
  assert.deepEqual(await claimCollection(JOB.id, [found(good(1))]), { state: "running" });
  assert.deepEqual(names(), ["claim_collect_job", "asset_jobs"]); // no retry reset, no second claim
});
test("a tap during failure backoff says to wait", async () => {
  reply(none, state({ collect_lease_expires_at: future() }));
  assert.deepEqual(await claimCollection(JOB.id, [found(good(1))]), { state: "waiting" });
});
test("a job that already moved past collecting is left alone", async () => {
  reply(none, state({ status: "pending_download" }));
  assert.deepEqual(await claimCollection(JOB.id, [found(good(1))]), { state: "moved_on" });
  assert.deepEqual(names(), ["claim_collect_job", "asset_jobs"]);
});
test("an unknown job is reported, not created", async () => {
  reply(none, { status: 200, body: [] });
  assert.deepEqual(await claimCollection(JOB.id, [found(good(1))]), { state: "not_found" });
});
test("out of attempts: the user's next tap is the explicit retry (reset, then one claim)", async () => {
  reply(none, state({ collect_attempts: 3 }), ok, claimed());
  assert.equal((await claimCollection(JOB.id, [found(good(1))])).state, "started");
  assert.deepEqual(names(), ["claim_collect_job", "asset_jobs", "retry_collect_job", "claim_collect_job"]);
});
test("out of attempts but a collection is still live: the reset is refused and nothing is killed", async () => {
  reply(none, state({ collect_attempts: 3 }), { status: 400, body: { code: "P0001", message: "a collection is already running for asset job x" } });
  assert.deepEqual(await claimCollection(JOB.id, [found(good(1))]), { state: "running" });
  assert.deepEqual(names(), ["claim_collect_job", "asset_jobs", "retry_collect_job"]);
});

// ---- running a claimed job ----
const run = (providers: AssetProvider[], o: Parameters<typeof finishCollection>[2] = quiet) => finishCollection(JOB, providers, o);

test("success: valid candidates are submitted in one call with the claim token", async () => {
  reply(ok);
  const r = await run([found(good(1), good(2), { bad: true })]);
  assert.deepEqual(r, { kind: "ok", candidates: 2, rejected: 1 });
  assert.deepEqual(names(), ["submit_collection"]);
  const sub = calls[0].body as { p_job: string; p_token: string; p_items: unknown[] };
  assert.deepEqual([sub.p_job, sub.p_token, sub.p_items.length], [JOB.id, "tok-1", 2]);
});
test("providers get the saved idea and a job id, never the claim token", async () => {
  reply(ok);
  let seen: unknown;
  await run([provider("p", async (i) => { seen = i; return { ok: true, candidates: [good(1)] }; })]);
  assert.deepEqual(seen, { jobId: JOB.id, ideaId: JOB.idea_id, title: JOB.title, idea: JOB.idea });
});
test("empty provider result is recorded for retry, never sent to review", async () => {
  reply(ok);
  assert.equal((await run([found()])).kind, "failed");
  assert.deepEqual(names(), ["fail_collect_job"]);
  assert.match(String(calls[0].body.p_error), /no candidates/);
});
test("a batch with only invalid candidates is recorded for retry", async () => {
  reply(ok);
  assert.equal((await run([found({ asset_type: "image" }, { source_url: "x" })])).kind, "failed");
  assert.match(String(calls[0].body.p_error), /invalid/);
  assert.ok(!names().includes("submit_collection"));
});
test("provider failure (returned or thrown) is recorded with a URL-free reason", async () => {
  reply(ok);
  const r = await run([provider("a", async () => ({ ok: false, error: "quota at https://api.example/q?key=SECRET" })),
    provider("b", async () => { throw new Error("boom"); })]);
  assert.equal(r.kind, "failed");
  const err = String(calls[0].body.p_error);
  assert.ok(err.includes("a:") && err.includes("b: boom") && !err.includes("SECRET"));
});
test("partial provider failure: the working provider's candidates still go through", async () => {
  reply(ok);
  assert.equal((await run([provider("bad", async () => { throw new Error("down"); }), found(good(1))])).kind, "ok");
  assert.equal(calls[0].fn, "submit_collection");
});
test("database insertion failure: the job is recorded as failed, not marked reviewed", async () => {
  reply({ status: 500 }, ok);
  assert.equal((await run([found(good(1))])).kind, "failed");
  assert.deepEqual(names(), ["submit_collection", "fail_collect_job"]);
});
test("user finalized (or the lease ran out) mid-collection: it stops and writes nothing more", async () => {
  reply(held);
  assert.deepEqual(await run([found(good(1))]), { kind: "stopped" });
  assert.deepEqual(names(), ["submit_collection"]);
});
test("a failed release is survivable: the lease expiry frees the job", async () => {
  reply({ status: 500 }, { status: 500 });
  assert.equal((await run([found(good(1))])).kind, "failed");
});
test("log lines never contain claim tokens or candidate URLs", async () => {
  reply(ok);
  const lines: string[] = [];
  await run([found(good(1))], { log: (l: Record<string, unknown>) => lines.push(JSON.stringify(l)) });
  const all = lines.join("");
  assert.ok(all.includes(JOB.id) && !all.includes("tok-1") && !all.includes("src.example") && !all.includes("secret"));
});

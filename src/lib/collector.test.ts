// Run with --conditions=react-server (see package.json "test"). Real collector code against a stand-in PostgREST.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { clean, parseCandidate, runCollector, validate, MAX_CANDIDATES, type AssetProvider } from "./collector.ts";

type Call = { fn: string; body: Record<string, unknown> };
let calls: Call[] = [], answers: { status: number; body?: unknown }[] = [];
beforeEach(() => {
  calls = []; answers = [];
  process.env.SUPABASE_URL = "https://db.test"; process.env.SUPABASE_SECRET_KEY = "secret";
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    calls.push({ fn: new URL(String(input)).pathname.replace("/rest/v1/rpc/", ""), body: JSON.parse(String(init?.body ?? "{}")) });
    const a = answers.shift() ?? { status: 200, body: [] };
    return new Response(a.body === undefined ? null : JSON.stringify(a.body), { status: a.status });
  }) as typeof fetch;
});
const reply = (...a: { status: number; body?: unknown }[]) => answers.push(...a);
const JOB = { id: "8b0e6d1a-1111-4c1c-9a7e-1d2c3b4a5f60", idea_id: "4365b119889f", title: "Robots cook", idea: { title: "Robots cook" }, collect_token: "tok-1", collect_attempts: 1 };
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

// ---- the run ----
test("no provider configured: nothing is claimed and it says so", async () => {
  const s = await runCollector([], quiet);
  assert.deepEqual(s, { configured: false, claimed: 0, collected: 0, failed: 0, stopped: 0 });
  assert.deepEqual(calls, []);
});
test("no waiting jobs: one claim, no work", async () => {
  reply(none);
  const s = await runCollector([found(good(1))], quiet);
  assert.deepEqual([s.claimed, names()], [0, ["claim_collect_job"]]);
});
test("success: valid candidates are submitted in one call with the claim token, and the job is collected", async () => {
  reply(claimed(), ok, none);
  const s = await runCollector([found(good(1), good(2), { bad: true })], quiet);
  assert.deepEqual([s.claimed, s.collected, s.failed], [1, 1, 0]);
  assert.deepEqual(names(), ["claim_collect_job", "submit_collection", "claim_collect_job"]);
  const sub = calls[1].body as { p_job: string; p_token: string; p_items: unknown[] };
  assert.deepEqual([sub.p_job, sub.p_token, sub.p_items.length], [JOB.id, "tok-1", 2]);
});
test("providers get the saved idea and a job id, never the claim token", async () => {
  reply(claimed(), ok, none);
  let seen: unknown;
  await runCollector([provider("p", async (i) => { seen = i; return { ok: true, candidates: [good(1)] }; })], quiet);
  assert.deepEqual(seen, { jobId: JOB.id, ideaId: JOB.idea_id, title: JOB.title, idea: JOB.idea });
});
test("empty provider result is released for retry, never sent to review", async () => {
  reply(claimed(), ok, none);
  const s = await runCollector([found()], quiet);
  assert.deepEqual([s.collected, s.failed], [0, 1]);
  assert.ok(!names().includes("submit_collection"));
  assert.equal(calls[1].fn, "fail_collect_job");
  assert.match(String(calls[1].body.p_error), /no candidates/);
});
test("a batch with only invalid candidates is released for retry", async () => {
  reply(claimed(), ok, none);
  const s = await runCollector([found({ asset_type: "image" }, { source_url: "x" })], quiet);
  assert.deepEqual([s.collected, s.failed], [0, 1]);
  assert.match(String(calls[1].body.p_error), /invalid/);
  assert.ok(!names().includes("submit_collection"));
});
test("provider failure (returned or thrown) is released with a URL-free reason", async () => {
  reply(claimed(), ok, none);
  const s = await runCollector([provider("a", async () => ({ ok: false, error: "quota at https://api.example/q?key=SECRET" })),
    provider("b", async () => { throw new Error("boom"); })], quiet);
  assert.equal(s.failed, 1);
  const err = String(calls[1].body.p_error);
  assert.ok(err.includes("a:") && err.includes("b: boom") && !err.includes("SECRET"));
});
test("partial provider failure: the working provider's candidates still go through", async () => {
  reply(claimed(), ok, none);
  const s = await runCollector([provider("bad", async () => { throw new Error("down"); }), found(good(1))], quiet);
  assert.deepEqual([s.collected, s.failed], [1, 0]);
  assert.equal(calls[1].fn, "submit_collection");
});
test("database insertion failure: the job is released, not marked reviewed", async () => {
  reply(claimed(), { status: 500 }, ok, none);
  const s = await runCollector([found(good(1))], quiet);
  assert.deepEqual([s.collected, s.failed], [0, 1]);
  assert.deepEqual(names().slice(0, 3), ["claim_collect_job", "submit_collection", "fail_collect_job"]);
});
test("user finalized (or the lease ran out) mid-collection: the collector stops and writes nothing more", async () => {
  reply(claimed(), held, none);
  const s = await runCollector([found(good(1))], quiet);
  assert.deepEqual([s.collected, s.failed, s.stopped], [0, 0, 1]);
  assert.ok(!names().includes("fail_collect_job"));
});
test("a failed release is survivable: the lease expiry recovers the job", async () => {
  reply(claimed(), { status: 500 }, { status: 500 }, none);
  const s = await runCollector([found(good(1))], quiet);
  assert.equal(s.failed, 1);
});
test("work per run is bounded by maxJobs", async () => {
  reply(claimed(), ok, claimed({ ...JOB, id: "2" }), ok, claimed({ ...JOB, id: "3" }), ok);
  const s = await runCollector([found(good(1))], { ...quiet, maxJobs: 2 });
  assert.equal(s.claimed, 2);
  assert.equal(names().filter((n) => n === "claim_collect_job").length, 2);
});
test("an exhausted time budget claims nothing", async () => {
  const s = await runCollector([found(good(1))], { ...quiet, budgetMs: 0 });
  assert.equal(s.claimed, 0);
  assert.deepEqual(calls, []);
});
test("log lines never contain claim tokens or candidate URLs", async () => {
  reply(claimed(), ok, none);
  const lines: string[] = [];
  await runCollector([found(good(1))], { log: (l) => lines.push(JSON.stringify(l)) });
  const all = lines.join("");
  assert.ok(all.includes(JOB.id) && !all.includes("tok-1") && !all.includes("src.example") && !all.includes("secret"));
});

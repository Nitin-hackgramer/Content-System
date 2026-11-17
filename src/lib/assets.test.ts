// Run with --conditions=react-server so "server-only" resolves to its no-op build (see package.json "test").
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { canFinalize, canReopen, canRetry, canSelect, friendly, groupOf, ideaSnapshot, isLive, JOB_COLUMNS, progress } from "./asset-status.ts";
import { accessToken, cookieOk, passcodeOk } from "./access.ts";
import { createJob, finalizeJob, getProject, listJobs, reopenJob, setSelected } from "./assets.ts";
import type { Idea } from "./types.ts";

// ---- a stand-in for PostgREST: records each request, answers from a queue ----
type Call = { method: string; path: string; params: URLSearchParams; body: unknown; prefer: string | null };
let calls: Call[] = [], answers: { status: number; body?: unknown }[] = [];
beforeEach(() => {
  calls = []; answers = [];
  process.env.SUPABASE_URL = "https://db.test"; process.env.SUPABASE_SECRET_KEY = "secret";
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const u = new URL(String(input));
    const h = new Headers(init?.headers);
    calls.push({ method: init?.method ?? "GET", path: u.pathname.replace("/rest/v1/", ""), params: u.searchParams, body: init?.body ? JSON.parse(String(init.body)) : undefined, prefer: h.get("Prefer") });
    const a = answers.shift() ?? { status: 200, body: [] };
    return new Response(a.body === undefined ? null : JSON.stringify(a.body), { status: a.status });
  }) as typeof fetch;
});
const reply = (...a: { status: number; body?: unknown }[]) => answers.push(...a);

const idea = { id: "4365b119889f", title: "  Robots learn to cook  ", format: "Short", hook: "Watch this", summary: "s", url: "https://x.test/a", score: 81, saved_at: "2026-11-01T00:00:00Z", trend: { class: "rising" } } as unknown as Idea;
const JOB = { id: "8b0e6d1a-1111-4c1c-9a7e-1d2c3b4a5f60", idea_id: idea.id, status: "collecting" };

// ---- rules ----
test("selection is only possible while collecting or in review", () => {
  assert.deepEqual((["collecting", "review", "finalized", "pending_download", "downloading", "completed", "failed", "retry"] as const).filter(canSelect), ["collecting", "review"]);
});
test("reopen is offered for queued and failed jobs, never once downloading or done", () => {
  assert.ok(canReopen("pending_download") && canReopen("failed") && canReopen("retry"));
  assert.ok(!canReopen("downloading") && !canReopen("completed") && !canReopen("review"));
});
test("retry only for a failed job that had been finalized", () => {
  assert.ok(canRetry({ status: "failed", finalized_at: "2026-11-01" }));
  assert.ok(!canRetry({ status: "failed", finalized_at: null }));
});
test("finalize needs at least one kept asset, each with a link", () => {
  assert.ok(!canFinalize("review", []));
  assert.ok(canFinalize("review", [{ download_url: null, source_url: "https://s" }]));
  assert.ok(!canFinalize("review", [{ download_url: null, source_url: null }]));
  assert.ok(!canFinalize("pending_download", [{ download_url: "https://d", source_url: null }]));
});
test("jobs group into in progress, queue and history", () => {
  assert.equal(groupOf("review"), "progress");
  assert.equal(groupOf("downloading"), "queue");
  assert.equal(groupOf("retry"), "queue");
  assert.equal(groupOf("failed"), "history");
});
test("pages poll only while something outside the browser moves the job", () => {
  assert.ok(isLive("downloading") && isLive("pending_download") && !isLive("review") && !isLive("completed"));
});
test("progress is a clamped number even when the database sends numeric as text", () => {
  assert.equal(progress({ download_progress: "42.50" }), 42.5);
  assert.equal(progress({ download_progress: 140 }), 100);
});
test("database rule messages become plain words, unknown ones stay generic", () => {
  assert.match(friendly("asset_selections are locked: job x is pending_download; reopen it to revise"), /Reopen the project/);
  assert.match(friendly("select at least one asset before finalizing job x"), /at least one/);
  assert.match(friendly("invalid asset job transition: completed -> review"), /moved on/);
  assert.match(friendly("relation public.asset_jobs does not exist"), /Could not save/);
});
test("the browser never gets the claim token", () => {
  assert.ok(!JOB_COLUMNS.includes("claim_token"));
});
test("idea snapshot keeps what the collector needs", () => {
  assert.deepEqual(ideaSnapshot(idea), { format: "Short", hook: "Watch this", summary: "s", url: "https://x.test/a", score: 81, saved_at: "2026-11-01T00:00:00Z", trend: "rising" });
});

// ---- access gate ----
test("passcode and cookie checks fail closed without STUDIO_KEY", () => {
  assert.ok(!passcodeOk("anything", undefined));
  assert.ok(!cookieOk(accessToken("k"), undefined));
});
test("the cookie is derived from the passcode, not the passcode itself", () => {
  assert.notEqual(accessToken("long-pass"), "long-pass");
  assert.ok(cookieOk(accessToken("long-pass"), "long-pass"));
  assert.ok(!cookieOk(accessToken("other"), "long-pass"));
  assert.ok(passcodeOk("long-pass", "long-pass") && !passcodeOk("long-pas", "long-pass"));
});

// ---- data layer against PostgREST ----
test("creating a job from an idea stores its title and snapshot", async () => {
  reply({ status: 200, body: [] }, { status: 201, body: [{ ...JOB }] });
  const job = await createJob(idea);
  assert.equal(job.id, JOB.id);
  const post = calls[1];
  assert.equal(post.method, "POST"); assert.equal(post.path, "asset_jobs");
  assert.equal(post.prefer, "return=representation");
  assert.deepEqual(post.body, { idea_id: idea.id, title: "Robots learn to cook", idea: ideaSnapshot(idea) });
});
test("an idea that already has an open job opens that job instead of making another", async () => {
  reply({ status: 200, body: [{ ...JOB, status: "review" }] });
  const job = await createJob(idea);
  assert.equal(job.status, "review");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.get("status"), "neq.completed");
});
test("two taps racing to create a job both land on the same one", async () => {
  reply({ status: 200, body: [] }, { status: 409, body: { code: "23505", message: "duplicate key" } }, { status: 200, body: [{ ...JOB }] });
  assert.equal((await createJob(idea)).id, JOB.id);
});
test("job list never asks for the claim token", async () => {
  await listJobs();
  assert.equal(calls[0].params.get("select"), JOB_COLUMNS);
});
test("a missing project is null, not an error", async () => {
  reply({ status: 200, body: [] }, { status: 200, body: [] }, { status: 200, body: [] });
  assert.equal(await getProject(JOB.id), null);
});
test("keep inserts a selection; keeping twice is fine", async () => {
  reply({ status: 201 }, { status: 409, body: { code: "23505", message: "duplicate" } });
  await setSelected(JOB.id, "c1", true);
  await setSelected(JOB.id, "c1", true);
  assert.deepEqual(calls[0].body, { job_id: JOB.id, candidate_id: "c1" });
});
test("keeping another job's candidate is an error, not silently ignored", async () => {
  reply({ status: 409, body: { code: "23503", message: "violates foreign key constraint" } });
  await assert.rejects(setSelected(JOB.id, "c-other", true));
});
test("remove deletes exactly that selection", async () => {
  reply({ status: 204 });
  await setSelected(JOB.id, "c1", false);
  assert.equal(calls[0].method, "DELETE");
  assert.equal(calls[0].params.get("job_id"), `eq.${JOB.id}`);
  assert.equal(calls[0].params.get("candidate_id"), "eq.c1");
});
test("finalize and reopen call the database functions", async () => {
  reply({ status: 200, body: { ...JOB, status: "pending_download" } }, { status: 200, body: { ...JOB, status: "review" } });
  assert.equal((await finalizeJob(JOB.id)).status, "pending_download");
  assert.equal((await reopenJob(JOB.id)).status, "review");
  assert.deepEqual(calls.map((c) => [c.path, c.body]), [["rpc/finalize_asset_job", { p_job: JOB.id }], ["rpc/reopen_asset_job", { p_job: JOB.id }]]);
});
test("a refused transition carries the database's rule message", async () => {
  reply({ status: 400, body: { code: "P0001", message: "select at least one asset before finalizing job x" } });
  await assert.rejects(finalizeJob(JOB.id), (e: Error & { rule?: string }) => /at least one asset/.test(e.rule ?? ""));
});
test("other database errors never echo their body", async () => {
  reply({ status: 500, body: { code: "42P01", message: "relation asset_jobs does not exist" } });
  await assert.rejects(listJobs(), (e: Error & { rule?: string | null }) => e.message === "Supabase 500" && e.rule === null);
});
test("a missing column or table reads as a missing migration, an outage does not", async () => {
  const { needsMigration } = await import("./assets.ts");
  reply({ status: 400, body: { code: "42703", message: "column asset_jobs.idea does not exist" } });
  await assert.rejects(listJobs(), (e) => needsMigration(e));
  reply({ status: 503, body: { message: "unavailable" } });
  await assert.rejects(listJobs(), (e) => !needsMigration(e));
});

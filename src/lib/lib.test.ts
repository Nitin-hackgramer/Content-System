import { project, rubberband } from "./motion.ts";
import { setMorph, takeMorph, setOrigin, peekOrigin } from "./morph.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { timeAgo, safeHref, host, claimLabel, isFresh } from "./format.ts";
import { parseSources, groupBy } from "./sources.ts";

test("timeAgo", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  assert.equal(timeAgo("2026-10-26T11:59:40Z", now), "Just now");
  assert.equal(timeAgo("2026-10-26T09:00:00Z", now), "3 hours ago");
  assert.equal(timeAgo("2026-10-26T11:00:00Z", now), "1 hour ago");
  assert.equal(timeAgo("2026-10-25T12:00:00Z", now), "1 day ago");
  assert.equal(timeAgo(null, now), "unknown");
  assert.equal(timeAgo("garbage", now), "unknown");
});

test("safeHref only passes http(s)", () => {
  assert.equal(safeHref("https://a.com/x"), "https://a.com/x");
  assert.equal(safeHref("javascript:alert(1)"), undefined);
  assert.equal(safeHref(null), undefined);
  assert.equal(host("https://www.dev.to/a"), "dev.to");
});

test("isFresh never calls old results today's", () => {
  const now = Date.parse("2026-11-15T12:00:00Z");
  assert.equal(isFresh("2026-11-15T03:00:00Z", now), true);
  assert.equal(isFresh("2026-11-13T12:00:00Z", now), false);
  assert.equal(isFresh(undefined, now), false);
});

test("claimLabel", () => assert.equal(claimLabel("first_party"), "First-party"));

test("parseSources reads the pipeline's report format", () => {
  const rows = parseSources({ "hn:claude code": "ok:11", "web:q": "ok:6 (cached 23m ago)", "x:q": "error:Timeout", "feed:OpenAI": "ok:0" });
  assert.deepEqual(rows.map((r) => [r.group, r.label, r.ok, r.count]), [
    ["Hacker News", "claude code", true, 11], ["Web search", "q", true, 6], ["X", "q", false, null], ["Official feeds", "OpenAI", true, 0],
  ]);
  assert.equal(rows[1].detail, "(cached 23m ago)");
  assert.equal(groupBy(rows, (r) => r.group).size, 4);
});

test("project and rubberband", () => {
  assert.equal(Math.round(project(1000)), 499);
  assert.equal(project(0), 0);
  assert.equal(rubberband(0, 400), 0);
  assert.ok(rubberband(100, 400) < 100 && rubberband(200, 400) > rubberband(100, 400) && rubberband(10000, 400) < 400);
});

test("takeMorph is one-shot, id-matched and expires", () => {
  const v = { id: "a", x: 0, y: 0, w: 1, h: 1, src: "s", radius: 0, at: 1000 };
  setMorph(v); assert.equal(takeMorph("b", 1500), null);
  setMorph(v); assert.equal(takeMorph("a", 1500), v); assert.equal(takeMorph("a", 1500), null);
  setMorph(v); assert.equal(takeMorph("a", 5000), null);
});

test("peekOrigin survives a double read and expires", () => {
  setOrigin(10, 20); const t = Date.now();
  assert.deepEqual(peekOrigin(t) && [peekOrigin(t)!.x, peekOrigin(t)!.y], [10, 20]);
  assert.equal(peekOrigin(t + 2000), null);
});

import { STATE_PREFIX, stateRow, mergeState } from "./state.ts";

test("idea state is one row per idea, so two writers never overwrite each other", () => {
  const a = stateRow("aaaa1111", "saved"), b = stateRow("bbbb2222", "shortlisted");
  assert.equal(a.key, STATE_PREFIX + "aaaa1111");
  assert.deepEqual(a.value, { s: "saved" });
  assert.deepEqual(mergeState({}, [a, b]), { aaaa1111: "saved", bbbb2222: "shortlisted" });
});

test("mergeState: rows win over the old single-row blob; a cleared row removes the idea", () => {
  const legacy = { aaaa1111: "saved", cccc3333: "archived" } as const;
  const rows = [stateRow("aaaa1111", "shortlisted"), stateRow("cccc3333", null)];
  assert.deepEqual(mergeState({ ...legacy }, rows), { aaaa1111: "shortlisted" });
  assert.deepEqual(mergeState({}, [{ key: "other:thing", value: { s: "saved" } }]), {}, "foreign keys are ignored");
});

import { isPrivateIp } from "./net.ts";
import { dbLabel } from "./format.ts";

test("isPrivateIp blocks every internal range, v4 and v6", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1",
    "::1", "::", "fc00::1", "fd12::3", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "224.0.0.1"]) assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ["8.8.8.8", "172.32.0.1", "104.18.2.3", "2606:4700::1111", "::ffff:8.8.8.8"]) assert.equal(isPrivateIp(ip), false, ip);
  assert.equal(isPrivateIp("not-an-ip"), true, "anything unparseable is refused");
});

test("dbLabel names the real problem", () => {
  assert.deepEqual(dbLabel(false, null, null), { v: "Not set", tone: "warn" });
  assert.deepEqual(dbLabel(true, "supabase", null), { v: "Connected", tone: "ok" });
  assert.deepEqual(dbLabel(true, "local", "Supabase 404"), { v: "Tables missing: run docs/supabase.sql", tone: "error" });
  assert.deepEqual(dbLabel(true, "local", "Supabase 401"), { v: "Key rejected", tone: "error" });
  assert.deepEqual(dbLabel(true, "local", "fetch failed"), { v: "Unreachable", tone: "error" });
});

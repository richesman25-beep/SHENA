import { test } from "node:test";
import assert from "node:assert/strict";
import { readLimitedJson, HttpInputError } from "../src/lib/http/json";
test("JSON body is bounded while streaming without trusting Content-Length", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"lines":[]}',
  });
  assert.deepEqual(await readLimitedJson(request), { lines: [] });
  const oversized = new Request("https://example.test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '"' + "x".repeat(100) + '"',
  });
  await assert.rejects(
    readLimitedJson(oversized, 16),
    (e: unknown) => e instanceof HttpInputError && e.status === 413,
  );
});
test("wrong content type and malformed JSON never reach the database", async () => {
  await assert.rejects(
    readLimitedJson(
      new Request("https://example.test", { method: "POST", body: "{}" }),
    ),
    (e: unknown) => e instanceof HttpInputError && e.status === 415,
  );
  await assert.rejects(
    readLimitedJson(
      new Request("https://example.test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    ),
    (e: unknown) => e instanceof HttpInputError && e.status === 400,
  );
});

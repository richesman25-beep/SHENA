import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DigitalDeliveryError,
  resolveDigitalDownload,
  type DigitalDeliveryDependencies,
} from "../src/lib/commerce/digital-delivery";
const id = "11111111-1111-4111-8111-111111111111";
const origin = "https://xxadpoebcslutlevzdsy.supabase.co";
const path = `${id}/${id}/${id}.pdf`;
function fixture() {
  const calls: string[] = [];
  const deps: DigitalDeliveryDependencies = {
    async user() {
      calls.push("user");
      return { id, verified: true };
    },
    async features() {
      calls.push("features");
      return { version: 1, enabled: true };
    },
    async release() {
      calls.push("release");
      return {
        bucket: "digital-products",
        object_path: path,
        display_name: "Fixture uniquement.pdf",
        status: "approved",
      };
    },
    async sign(p, ttl, name) {
      calls.push("sign");
      assert.equal(p, path);
      assert.equal(ttl, 60);
      assert.equal(name, "Fixture uniquement.pdf");
      return `${origin}/storage/v1/object/sign/digital-products/${p}?token=synthetic-local-only`;
    },
  };
  return { calls, deps };
}
test("no download service is called when activation is disabled", async () => {
  const { calls, deps } = fixture();
  await assert.rejects(
    resolveDigitalDownload(id, false, origin, deps),
    (e: unknown) => e instanceof DigitalDeliveryError && e.status === 404,
  );
  assert.deepEqual(calls, []);
});
test("unauthenticated, unverified and unavailable database flags never sign", async () => {
  for (const change of [
    { user: async () => null },
    { user: async () => ({ id, verified: false }) },
    { features: async () => null },
    { features: async () => ({ version: 1, enabled: false }) },
    { features: async () => ({ version: 2, enabled: true }) },
  ]) {
    const { calls, deps } = fixture();
    await assert.rejects(
      resolveDigitalDownload(id, true, origin, { ...deps, ...change }),
    );
    assert.equal(calls.includes("sign"), false);
  }
});
test("missing entitlement, quarantine, nonapproved asset and unsafe paths never sign", async () => {
  for (const release of [
    null,
    {
      bucket: "digital-quarantine",
      object_path: path,
      display_name: "x.pdf",
      status: "approved",
    },
    {
      bucket: "digital-products",
      object_path: path,
      display_name: "x.pdf",
      status: "pending",
    },
    {
      bucket: "digital-products",
      object_path: "../secret.pdf",
      display_name: "x.pdf",
      status: "approved",
    },
    {
      bucket: "digital-products",
      object_path: path,
      display_name: "x\r\ny.pdf",
      status: "approved",
    },
  ]) {
    const { calls, deps } = fixture();
    await assert.rejects(
      resolveDigitalDownload(id, true, origin, {
        ...deps,
        release: async () => release,
      }),
    );
    assert.equal(calls.includes("sign"), false);
  }
});
test("RLS signing denial and untrusted URL are refused", async () => {
  for (const sign of [
    async () => null,
    async () => "https://evil.test/file?token=x",
    async () =>
      `${origin}/storage/v1/object/sign/digital-products/wrong-file?token=x`,
    async () => `${origin}/storage/v1/object/public/digital-products/x`,
  ]) {
    const { deps } = fixture();
    await assert.rejects(
      resolveDigitalDownload(id, true, origin, { ...deps, sign }),
    );
  }
});
test("only verified authorization produces a private 60-second link", async () => {
  const { calls, deps } = fixture();
  const url = await resolveDigitalDownload(id, true, origin, deps);
  assert.ok(
    url.startsWith(origin + "/storage/v1/object/sign/digital-products/"),
  );
  assert.deepEqual(calls, ["user", "features", "release", "sign"]);
});

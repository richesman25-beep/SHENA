import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertPreviewIsolation,
  isStagingCheckout,
  shenaStagingOrigin,
  shenaStagingProjectRef,
} from "../src/lib/supabase/deployment";
const staging = {
  VERCEL_ENV: "preview",
  SHENA_DEPLOYMENT_TARGET: "staging",
  SHENA_STAGING_PROJECT_REF: shenaStagingProjectRef,
  SHENA_CHECKOUT_MODE: "staging",
};
test("preview accepts only the exact staging project with explicit configuration", () => {
  assert.doesNotThrow(() =>
    assertPreviewIsolation(shenaStagingOrigin, staging),
  );
  for (const url of [
    "https://production.supabase.co",
    "https://example.com",
    shenaStagingOrigin + "/",
  ])
    assert.throws(() => assertPreviewIsolation(url, staging));
  assert.throws(() =>
    assertPreviewIsolation(shenaStagingOrigin, { VERCEL_ENV: "preview" }),
  );
  assert.throws(() =>
    assertPreviewIsolation(shenaStagingOrigin, {
      ...staging,
      SHENA_STAGING_PROJECT_REF: "other",
    }),
  );
});
test("production never allows staging checkout and its existing catalogue is preserved", () => {
  assert.doesNotThrow(() =>
    assertPreviewIsolation("https://production.supabase.co", {
      VERCEL_ENV: "production",
    }),
  );
  assert.equal(isStagingCheckout(shenaStagingOrigin, staging), true);
  assert.equal(
    isStagingCheckout(shenaStagingOrigin, {
      ...staging,
      VERCEL_ENV: "production",
    }),
    false,
  );
  assert.equal(
    isStagingCheckout("https://production.supabase.co", staging),
    false,
  );
  assert.equal(
    isStagingCheckout(shenaStagingOrigin, {
      ...staging,
      SHENA_CHECKOUT_MODE: "disabled",
    }),
    false,
  );
});

import { trustedRecoveryOrigin } from "../src/lib/admin/recovery";
test("preview recovery refuses inherited production origin and untrusted hosts", () => {
  const env = {
    VERCEL_ENV: "preview",
    VERCEL_URL: "shena-preview.vercel.app",
    SHENA_SITE_URL: "https://shena-2go5.vercel.app",
  };
  assert.equal(trustedRecoveryOrigin(env), null);
  assert.equal(
    trustedRecoveryOrigin({
      ...env,
      SHENA_SITE_URL: "https://shena-preview.vercel.app",
    }),
    "https://shena-preview.vercel.app",
  );
  assert.equal(
    trustedRecoveryOrigin({ ...env, VERCEL_URL: "evil.test/path" }),
    null,
  );
});

test("a declared local staging cannot use production and production cannot use staging", () => {
  assert.throws(() =>
    assertPreviewIsolation("https://production.supabase.co", {
      ...staging,
      VERCEL_ENV: undefined,
    }),
  );
  assert.throws(() =>
    assertPreviewIsolation(shenaStagingOrigin, {
      ...staging,
      VERCEL_ENV: "production",
    }),
  );
});

/** Fonction plateforme auditée : essais exclusivement en PostgreSQL local. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("contrôle definer : seul le corps événementiel audité est exempté", async () => {
  const db = await PGlite.create();
  try {
    await db.exec("CREATE ROLE anon;CREATE ROLE authenticated;");
    await db.exec(
      await readFile(
        new URL("fixtures/production-rls-auto-enable.sql", import.meta.url),
        "utf8",
      ),
    );
    const script = await readFile(
      new URL(
        "../docs/proposals/production-01-admin-production-candidate.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const match = script.match(
      /IF EXISTS\((SELECT 1 FROM pg_catalog\.pg_proc p WHERE p\.pronamespace='public'::regnamespace[\s\S]*?)\) THEN\n    RAISE EXCEPTION 'RPC SECURITY DEFINER/,
    );
    assert.ok(match);
    const blocked = async () =>
      (
        await db.query<{ blocked: boolean }>(
          `SELECT EXISTS(${match[1]}) AS blocked`,
        )
      ).rows[0].blocked;
    assert.equal(await blocked(), false);
    await db.exec("ALTER FUNCTION public.rls_auto_enable() RESET search_path");
    assert.equal(await blocked(), true); // NULL ne doit jamais exempter un definer.
    await db.exec(
      "ALTER FUNCTION public.rls_auto_enable() SET search_path=pg_catalog",
    );
    assert.equal(await blocked(), false);
    await db.exec(
      "CREATE FUNCTION public.unreviewed() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT true $$",
    );
    assert.equal(await blocked(), true);
    await db.exec(
      "DROP FUNCTION public.unreviewed();CREATE OR REPLACE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN RETURN; END $$",
    );
    assert.equal(await blocked(), true);
  } finally {
    await db.close();
  }
});

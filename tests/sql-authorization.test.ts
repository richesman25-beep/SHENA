/** PostgreSQL embarqué, en mémoire : données synthétiques, aucun réseau Supabase. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const clientId = "11111111-1111-4111-8111-111111111111",
  adminA = "22222222-2222-4222-8222-222222222222",
  adminB = "33333333-3333-4333-8333-333333333333";
export const syntheticSchema = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon,authenticated;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz,raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.sub',true),''),NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
-- CONTRAT SYNTHÉTIQUE DE TEST, pas un schéma constaté de Production.
CREATE TABLE public.products(id uuid PRIMARY KEY,created_at timestamptz NOT NULL,name text NOT NULL,description text,price_htg numeric,product_type text,stock integer,image_url text,active boolean NOT NULL);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active product" ON public.products FOR SELECT TO PUBLIC USING(active=true);
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.products TO anon,authenticated;
GRANT INSERT(name),UPDATE(active) ON public.products TO anon,authenticated;
INSERT INTO auth.users(id,email_confirmed_at,raw_app_meta_data) VALUES
('${clientId}',now(),'{}'),('${adminA}',now(),'{"shena_role":"admin"}'),('${adminB}',now(),'{"shena_role":"admin"}');
INSERT INTO public.products VALUES('44444444-4444-4444-8444-444444444444',now(),'Fixture locale active','Synthétique',100,'physical',4,NULL,true),('55555555-5555-4555-8555-555555555555',now(),'Fixture locale inactive','Synthétique',50,'digital',0,NULL,false);
`;
async function read(path: string) {
  return readFile(new URL("../" + path, import.meta.url), "utf8");
}
test("Modèle PostgreSQL local: authentification admin et métadonnées, hors correctif ACL final", async (t) => {
  const notices: string[] = [];
  const db = await PGlite.create();
  try {
    await db.exec("SET client_min_messages=notice;" + syntheticSchema);
    const original = await db.query(
      "SELECT id,name,price_htg,stock,active FROM products ORDER BY id",
    );
    await t.test(
      "reproduit les privilèges excessifs rapportés et conserve les lignes",
      async () => {
        const r = await db.query<{ truncate: boolean }>(
          "SELECT has_table_privilege('anon','public.products','TRUNCATE') AS truncate",
        );
        assert.equal(r.rows[0].truncate, true);
      },
    );
    await t.test(
      "migration admin corrigée: client non promu, deux admins autorisés, prix/stock invalides refusés",
      async () => {
        await db.exec(
          `SELECT set_config('shena.review_context','staging-reviewed',false),set_config('shena.test_client_id','${clientId}',false),set_config('shena.test_admin_a_id','${adminA}',false),set_config('shena.test_admin_b_id','${adminB}',false)`,
        );
        const proposal = await read(
          "docs/proposals/production-01-admin-reviewed.sql",
        );
        const checks = await read(
          "docs/proposals/tests/admin-products-staging.sql",
        );
        await db.exec(proposal.replace("-- SHENA_STAGING_TESTS_HERE", checks), {
          onNotice: (n) => notices.push(n.message || ""),
        });
        for (const prefix of [
          "PASS anonymous:",
          "PASS client:",
          "PASS admin A:",
          "PASS admin B:",
          "PASS rôle révoqué",
        ])
          assert.ok(
            notices.some((n) => n.startsWith(prefix)),
            prefix,
          );
        assert.deepEqual(
          (
            await db.query(
              "SELECT id,name,price_htg,stock,active FROM products ORDER BY id",
            )
          ).rows,
          original.rows,
        );
        assert.equal(
          (
            await db.query<{ count: number }>(
              "SELECT count(*)::int AS count FROM auth.users WHERE raw_app_meta_data->>'shena_role'='admin'",
            )
          ).rows[0].count,
          2,
        );
      },
    );
  } finally {
    await db.close();
  }
});

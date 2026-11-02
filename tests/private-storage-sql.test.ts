/** Vérifie RLS sur une représentation SQL locale de Storage, pas le service HTTP Supabase. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const client = "11111111-1111-4111-8111-111111111111",
  admin = "22222222-2222-4222-8222-222222222222",
  product = "44444444-4444-4444-8444-444444444444";
const body = (s: string) =>
  s.replace(/^BEGIN;\s*$/m, "").replace(/ROLLBACK;\s*$/, "");
test("PostgreSQL local: fichiers numériques privés, imports admin seulement et aucun accès client", async () => {
  const db = await PGlite.create();
  let savepoint = 0;
  async function deny(run: () => Promise<unknown>) {
    const p = "deny_" + ++savepoint;
    await db.exec(`SAVEPOINT ${p}`);
    try {
      await assert.rejects(run);
    } finally {
      await db.exec(`ROLLBACK TO SAVEPOINT ${p};RELEASE SAVEPOINT ${p}`);
    }
  }
  try {
    await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth TO anon,authenticated;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE TABLE products(id uuid PRIMARY KEY,created_at timestamptz NOT NULL,name text,description text,price_htg numeric,product_type text,stock integer,image_url text,active boolean);
 ALTER TABLE products ENABLE ROW LEVEL SECURITY;CREATE POLICY active_products ON products FOR SELECT USING(active);GRANT ALL ON products TO anon,authenticated;
 INSERT INTO auth.users VALUES('${client}',now(),'{}','{}'),('${admin}',now(),'{"shena_role":"admin"}','{}');
 INSERT INTO products VALUES('${product}',now(),'Fixture PDF',NULL,100,'digital',0,NULL,true);
 CREATE SCHEMA storage;GRANT USAGE ON SCHEMA storage TO anon,authenticated;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
 SELECT set_config('shena.review_context','staging-reviewed',false);`);
    await db.exec("BEGIN");
    await db.exec(
      body(
        await readFile(
          new URL(
            "../docs/proposals/production-01-admin-reviewed.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    );
    await db.exec(
      body(
        await readFile(
          new URL(
            "../docs/proposals/staging/02-storage-review.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    );
    await db.exec(
      body(
        await readFile(
          new URL(
            "../docs/proposals/staging/04-storage-capabilities-review.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    );
    const buckets = (
      await db.query<{ id: string; public: boolean }>(
        "SELECT id,public FROM storage.buckets ORDER BY id",
      )
    ).rows;
    assert.equal(
      buckets.find((b) => b.id === "digital-products")?.public,
      false,
    );
    assert.equal(
      buckets.find((b) => b.id === "digital-quarantine")?.public,
      false,
    );
    assert.equal(buckets.find((b) => b.id === "product-images")?.public, true);
    await db.exec(
      `INSERT INTO storage.objects(bucket_id,name) VALUES('digital-products','${admin}/${product}/paid.pdf');SET LOCAL ROLE anon;`,
    );
    assert.equal(
      (
        await db.query(
          "SELECT id FROM storage.objects WHERE bucket_id='digital-products'",
        )
      ).rows.length,
      0,
    );
    await deny(() =>
      db.query(
        "INSERT INTO storage.objects(bucket_id,name) VALUES('digital-quarantine','anon.pdf')",
      ),
    );
    await db.exec(
      `RESET ROLE;SELECT set_config('request.jwt.claim.sub','${client}',true);SET LOCAL ROLE authenticated;`,
    );
    assert.equal(
      (await db.query("SELECT id FROM storage.objects")).rows.length,
      0,
    );
    await deny(() =>
      db.query(
        "INSERT INTO storage.objects(bucket_id,name) VALUES('digital-quarantine',$1)",
        [`${client}/${product}/test.pdf`],
      ),
    );
    await db.exec(
      `RESET ROLE;SELECT set_config('request.jwt.claim.sub','${admin}',true);SET LOCAL ROLE authenticated;`,
    );
    assert.equal(
      (
        await db.query(
          "SELECT id FROM storage.objects WHERE bucket_id='digital-products'",
        )
      ).rows.length,
      1,
    );
    await db.query(
      "INSERT INTO storage.objects(bucket_id,name) VALUES('digital-quarantine',$1)",
      [`${admin}/${product}/test.pdf`],
    );
    await deny(() =>
      db.query(
        "INSERT INTO storage.objects(bucket_id,name) VALUES('digital-products',$1)",
        [`${admin}/${product}/unscanned.pdf`],
      ),
    );
    await deny(() =>
      db.query(
        "INSERT INTO storage.objects(bucket_id,name) VALUES('digital-quarantine',$1)",
        [`${client}/${product}/wrong-owner.pdf`],
      ),
    );
    await db.exec("RESET ROLE;ROLLBACK;");
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM storage.buckets",
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

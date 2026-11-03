/** Simulation locale uniquement : aucune commande SQL distante. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("correctif ACL exact : lecture préservée et opérations dangereuses refusées", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
 REVOKE CREATE ON SCHEMA public FROM PUBLIC;
 CREATE TABLE public.products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now(),name text,description text,price_htg numeric,product_type text,stock integer DEFAULT 0,image_url text,active boolean DEFAULT false);
 ALTER TABLE products ENABLE ROW LEVEL SECURITY;
 CREATE POLICY "Public can view active product" ON products FOR SELECT TO anon,authenticated USING(active=true);
 GRANT ALL ON products TO anon,authenticated;
 INSERT INTO products(name,active) VALUES('Fixture locale uniquement',true),('Fixture inactive',false);
 SELECT set_config('shena.acl_review_context','products-acl-reviewed',false);`);
    const script = await readFile(
      new URL(
        "../docs/proposals/production-00-products-acl-revoke-reviewed.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(script.replace(/ROLLBACK;\s*$/, ""));
    for (const role of ["anon", "authenticated"]) {
      const rights = (
        await db.query<{ privilege: string; allowed: boolean }>(
          `SELECT p AS privilege,has_table_privilege('${role}','products',p) AS allowed FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p`,
        )
      ).rows;
      for (const row of rights)
        assert.equal(
          row.allowed,
          row.privilege === "SELECT",
          role + ": " + row.privilege,
        );
      await db.exec(`SET LOCAL ROLE ${role}`);
      assert.equal((await db.query("SELECT * FROM products")).rows.length, 1);
      for (const sql of [
        "TRUNCATE products",
        "INSERT INTO products(name) VALUES('Interdit')",
        "UPDATE products SET active=false",
        "DELETE FROM products",
      ]) {
        await db.exec("SAVEPOINT denial");
        await assert.rejects(db.exec(sql), /permission denied/);
        await db.exec("ROLLBACK TO SAVEPOINT denial;RELEASE SAVEPOINT denial");
      }
      await db.exec("RESET ROLE");
    }
    assert.equal(
      (await db.query<{ n: number }>("SELECT count(*)::int n FROM products"))
        .rows[0].n,
      2,
    );
    assert.equal(
      (
        await db.query(
          "SELECT * FROM pg_policy WHERE polrelid='public.products'::regclass",
        )
      ).rows.length,
      1,
    );
    await db.exec("ROLLBACK");
  } finally {
    await db.close();
  }
});

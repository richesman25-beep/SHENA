/** PostgreSQL LOCAL synthétique : aucune API distante, aucun paiement réel. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const client = "11111111-1111-4111-8111-111111111111",
  a = "22222222-2222-4222-8222-222222222222",
  b = "33333333-3333-4333-8333-333333333333",
  product = "44444444-4444-4444-8444-444444444444",
  other = "55555555-5555-4555-8555-555555555555",
  file = "66666666-6666-4666-8666-666666666666";
const path = `${a}/${product}/${file}.pdf`;
const body = (s: string) =>
  s.replace(/^BEGIN;\s*$/m, "").replace(/ROLLBACK;\s*$/, "");
const source = (p: string) =>
  readFile(new URL("../" + p, import.meta.url), "utf8");
test("modèle local Production : anciens fichiers conservés, paiements et livraison numérique verrouillés", async (t) => {
  const db = await PGlite.create();
  let n = 0;
  async function actor(id: string | null) {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      id || "",
    ]);
    await db.exec(`SET LOCAL ROLE ${id ? "authenticated" : "anon"}`);
  }
  async function denied(run: () => Promise<unknown>) {
    const name = "deny_" + ++n;
    await db.exec(`SAVEPOINT ${name}`);
    try {
      await assert.rejects(run);
    } finally {
      await db.exec(`ROLLBACK TO SAVEPOINT ${name};RELEASE SAVEPOINT ${name}`);
    }
  }
  async function objects() {
    return (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM storage.objects WHERE bucket_id='digital-products'",
      )
    ).rows[0].n;
  }
  try {
    await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;REVOKE CREATE ON SCHEMA public FROM PUBLIC;
 CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth TO anon,authenticated;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE TABLE public.products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now(),name text,description text,price_htg numeric,product_type text,stock integer DEFAULT 0,image_url text,active boolean DEFAULT false);
 ALTER TABLE products ENABLE ROW LEVEL SECURITY;CREATE POLICY active_products ON products FOR SELECT TO anon,authenticated USING(active=true);GRANT ALL ON products TO anon,authenticated;
 INSERT INTO auth.users VALUES('${client}','client@example.test',now(),'{}','{"shena_role":"admin"}'),('${a}','a@example.test',now(),'{"shena_role":"admin"}','{}'),('${b}','b@example.test',now(),'{"shena_role":"admin"}','{}'),('${other}','other@example.test',now(),'{}','{}');
 INSERT INTO products(id,name,price_htg,product_type,stock,active) VALUES('${product}','PDF synthétique uniquement',100,'digital',0,true);
 CREATE SCHEMA storage;GRANT USAGE ON SCHEMA storage TO anon,authenticated;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text);
 ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT ALL ON storage.buckets,storage.objects TO anon,authenticated;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
 INSERT INTO storage.buckets VALUES('product-images','product-images',true,5242880,ARRAY['image/jpeg']);
 INSERT INTO storage.objects(bucket_id,name) VALUES('product-images','legacy/existing.jpg');
 SELECT set_config('shena.review_context','production-reviewed',false),set_config('shena.target_project_ref','xxadpoebcslutlevzdsy',false),set_config('shena.backup_restore_verified','yes',false);BEGIN;`);
    // Étiquettes synthétiques pour exercer les gardes, aucune restauration certifiée.
    // Le correctif ACL final 00 n'est PAS exécuté par cette suite locale.
    await db.exec(
      body(
        await source(
          "docs/proposals/production-01-admin-production-candidate.sql",
        ),
      ),
    );
    await db.exec(
      body(
        await source(
          "docs/proposals/production-activation/02-commerce-review.sql",
        ),
      ),
    );
    await db.exec(
      "CREATE POLICY old_broad_objects ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);CREATE POLICY old_broad_buckets ON storage.buckets FOR ALL TO anon,authenticated USING(true) WITH CHECK(true)",
    );
    await db.exec(
      body(
        await source(
          "docs/proposals/production-activation/02-storage-acl-review.sql",
        ),
      ),
    );
    await db.exec(
      body(
        await source(
          "docs/proposals/production-activation/03-storage-review.sql",
        ),
      ),
    );
    await db.exec(
      body(
        await source(
          "docs/proposals/production-activation/04-digital-delivery-review.sql",
        ),
      ),
    );
    await t.test(
      "bucket JPEG existant préservé et nouveaux buckets privés",
      async () => {
        const row = (
          await db.query<{
            public: boolean;
            file_size_limit: number;
            allowed_mime_types: string[];
          }>(
            "SELECT public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='product-images'",
          )
        ).rows[0];
        assert.equal(row.public, true);
        assert.equal(Number(row.file_size_limit), 5242880);
        assert.deepEqual(row.allowed_mime_types, ["image/jpeg", "image/webp"]);
        assert.equal(
          (
            await db.query<{ n: number }>(
              "SELECT count(*)::int n FROM storage.buckets WHERE id IN('digital-products','digital-quarantine') AND NOT public",
            )
          ).rows[0].n,
          2,
        );
        await actor(client);
        assert.equal(
          (
            await db.query<{ n: number }>(
              "SELECT count(*)::int n FROM storage.objects WHERE name='legacy/existing.jpg'",
            )
          ).rows[0].n,
          1,
        );
        await denied(() =>
          db.query(
            "INSERT INTO storage.objects(bucket_id,name) VALUES('product-images',$1)",
            [`${client}/image.webp`],
          ),
        );
        await denied(() =>
          db.query(
            "INSERT INTO storage.objects(bucket_id,name) VALUES('digital-products',$1)",
            [path],
          ),
        );
      },
    );
    await db.exec("RESET ROLE");
    await db.exec(
      "UPDATE commerce_settings SET orders_enabled=true,reservation_minutes=60,manual_payments_enabled=true",
    );
    await actor(client);
    const order = (
      await db.query<{ o: { id: string } }>(
        "SELECT shena_place_order($1::jsonb,NULL,NULL,$2::jsonb,$3,10000) o",
        [
          JSON.stringify([{ id: product, quantity: 1 }]),
          JSON.stringify({
            name: "Fixture client",
            phone: "+509 0000 0000",
            address: "",
            note: "",
          }),
          crypto.randomUUID(),
        ],
      )
    ).rows[0].o.id;
    let review = "",
      release = "";
    await t.test(
      "aucune revue monétaire sans compte marchand approuvé",
      async () => {
        await actor(a);
        await denied(() =>
          db.query(
            "SELECT shena_submit_payment_review($1,'moncash','FIXTURE-ONLY',10000,'Contrôle synthétique uniquement',$2)",
            [order, crypto.randomUUID()],
          ),
        );
        await db.exec("RESET ROLE");
        await db.exec(
          "INSERT INTO commerce_payment_accounts(provider,display_name,account_identifier,approval_evidence,active) VALUES('moncash','Fixture sans encaissement','FIXTURE-ONLY','Preuve synthétique locale uniquement',true)",
        );
        await actor(a);
        review = (
          await db.query<{ id: string }>(
            "SELECT shena_submit_payment_review($1,'moncash','FIXTURE-ONLY',10000,'Contrôle synthétique uniquement',$2) id",
            [order, crypto.randomUUID()],
          )
        ).rows[0].id;
        await denied(() =>
          db.query(
            "SELECT shena_decide_payment_review($1,'approved','Tentative auto approbation refusée')",
            [review],
          ),
        );
      },
    );
    await t.test(
      "fichier immuable et double approbation obligatoires",
      async () => {
        await actor(a);
        await db.query(
          "INSERT INTO storage.objects(bucket_id,name) VALUES('digital-products',$1)",
          [path],
        );
        release = (
          await db.query<{ id: string }>(
            "SELECT shena_register_digital_release($1,$2,'Fixture.pdf',$3,'Rapport synthétique de contrôle sans fichier réel') id",
            [product, path, "a".repeat(64)],
          )
        ).rows[0].id;
        await denied(() =>
          db.query(
            "SELECT shena_review_digital_release($1,'approved','Auto approbation de fichier refusée')",
            [release],
          ),
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "WITH x AS(UPDATE storage.objects SET name='replaced.pdf' WHERE name=$1 RETURNING 1) SELECT count(*)::int n FROM x",
              [path],
            )
          ).rows[0].n,
          0,
        );
        await actor(b);
        await db.query(
          "SELECT shena_review_digital_release($1,'approved','Second contrôle synthétique du fichier')",
          [release],
        );
      },
    );
    await t.test(
      "ancien accès permissif ne contourne ni paiement ni activation",
      async () => {
        await actor(null);
        assert.equal(await objects(), 0);
        await actor(client);
        assert.equal(await objects(), 0);
        await db.exec("RESET ROLE");
        await db.exec(
          "UPDATE commerce_settings SET digital_delivery_enabled=true",
        );
        await actor(client);
        assert.equal(await objects(), 0); // Toujours non payé.
        await actor(b);
        await db.query(
          "SELECT shena_decide_payment_review($1,'approved','Seconde validation synthétique de paiement')",
          [review],
        );
        await actor(other);
        assert.equal(await objects(), 0);
        await actor(client);
        assert.equal(await objects(), 1);
        assert.equal(
          (
            await db.query<{ n: number }>(
              "SELECT count(*)::int n FROM digital_releases",
            )
          ).rows[0].n,
          1,
        );
        await denied(() =>
          db.query(
            "UPDATE commerce_payment_accounts SET account_identifier='fraude'",
          ),
        );
      },
    );
    await t.test(
      "expiration opérateur idempotente et interdite au client",
      async () => {
        await actor(client);
        await denied(() =>
          db.query("SELECT shena_expire_unpaid_reservations(100)"),
        );
        await db.exec("RESET ROLE");
        const physical = "77777777-7777-4777-8777-777777777777";
        await db.query(
          "INSERT INTO products(id,name,price_htg,product_type,stock,active) VALUES($1,'Fixture stock',10,'physical',5,true)",
          [physical],
        );
        const zone = crypto.randomUUID();
        await db.query(
          "INSERT INTO commerce_delivery_zones(id,name,department_id,commune_id,fee_minor,active) VALUES($1,'Fixture zone','centre','hinche',0,true)",
          [zone],
        );
        await actor(client);
        const expired = (
          await db.query<{ o: { id: string } }>(
            "SELECT shena_place_order($1::jsonb,$2::jsonb,$3,$4::jsonb,$5,1000) o",
            [
              JSON.stringify([{ id: physical, quantity: 1 }]),
              JSON.stringify({ departmentId: "centre", communeId: "hinche" }),
              zone,
              JSON.stringify({
                name: "Fixture client",
                phone: "+509 0000 0000",
                address: "Adresse synthétique",
                note: "",
              }),
              crypto.randomUUID(),
            ],
          )
        ).rows[0].o.id;
        await db.exec("RESET ROLE");
        assert.equal(
          (
            await db.query<{ stock: number }>(
              "SELECT stock FROM products WHERE id=$1",
              [physical],
            )
          ).rows[0].stock,
          4,
        );
        await db.query(
          "UPDATE commerce_orders SET reservation_expires_at=now()-interval '1 minute' WHERE id=$1",
          [expired],
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "SELECT shena_expire_unpaid_reservations(100) n",
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "SELECT shena_expire_unpaid_reservations(100) n",
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await db.query<{ stock: number }>(
              "SELECT stock FROM products WHERE id=$1",
              [physical],
            )
          ).rows[0].stock,
          5,
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "SELECT count(*)::int n FROM commerce_audit_events WHERE order_id=$1 AND action='order.reservation_expired'",
              [expired],
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test(
      "révocation du fichier supprime les nouveaux accès autorisés",
      async () => {
        await actor(b);
        await db.query(
          "SELECT shena_review_digital_release($1,'revoked','Suspension synthétique de la version')",
          [release],
        );
        await actor(client);
        assert.equal(await objects(), 0);
        assert.equal(
          (
            await db.query<{ n: number }>(
              "WITH x AS(DELETE FROM storage.objects WHERE bucket_id='digital-products' RETURNING 1) SELECT count(*)::int n FROM x",
            )
          ).rows[0].n,
          0,
        );
      },
    );
  } finally {
    await db.close();
  }
});

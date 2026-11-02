/** Moteur PostgreSQL local en mémoire. Aucun RPC ni compte Supabase réel. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const client = "11111111-1111-4111-8111-111111111111",
  adminA = "22222222-2222-4222-8222-222222222222",
  adminB = "33333333-3333-4333-8333-333333333333",
  other = "66666666-6666-4666-8666-666666666666";
const physical = "44444444-4444-4444-8444-444444444444",
  digital = "55555555-5555-4555-8555-555555555555",
  zone = "77777777-7777-4777-8777-777777777777";
const setup = `CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth TO anon,authenticated;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz,raw_app_meta_data jsonb NOT NULL DEFAULT '{}',raw_user_meta_data jsonb NOT NULL DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE products(id uuid PRIMARY KEY,created_at timestamptz NOT NULL,name text NOT NULL,description text,price_htg numeric,product_type text,stock integer,image_url text,active boolean NOT NULL);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;CREATE POLICY "Public can view active product" ON products FOR SELECT USING(active=true);GRANT ALL ON products TO anon,authenticated;
INSERT INTO auth.users(id,email_confirmed_at,raw_app_meta_data) VALUES('${client}',now(),'{}'),('${other}',now(),'{}'),('${adminA}',now(),'{"shena_role":"admin"}'),('${adminB}',now(),'{"shena_role":"admin"}');
INSERT INTO products VALUES('${physical}',now(),'Physique synthétique','Fixture',100,'physical',4,NULL,true),('${digital}',now(),'Numérique synthétique','Fixture',50,'digital',0,NULL,true);`;
const body = (sql: string) =>
  sql.replace(/^BEGIN;\s*$/m, "").replace(/ROLLBACK;\s*$/, "");
async function source(path: string) {
  return readFile(new URL("../" + path, import.meta.url), "utf8");
}
test("PostgreSQL local: commandes atomiques, idempotence, isolation et paiement contrôlé", async (t) => {
  const db = await PGlite.create();
  async function actor(id: string | null) {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      id || "",
    ]);
    await db.exec(`SET ROLE ${id ? "authenticated" : "anon"}`);
  }
  async function owner() {
    await db.exec("RESET ROLE");
  }
  let point = 0;
  async function reject(run: () => Promise<unknown>, pattern?: RegExp) {
    const name = "attempt_" + ++point;
    await db.exec(`SAVEPOINT ${name}`);
    try {
      if (pattern) await assert.rejects(run, pattern);
      else await assert.rejects(run);
    } finally {
      await db.exec(`ROLLBACK TO SAVEPOINT ${name};RELEASE SAVEPOINT ${name}`);
    }
  }
  const contact = {
    name: "Client synthétique",
    phone: "+509 1234 5678",
    address: "Adresse staging uniquement",
    note: "Test local",
  };
  async function place(key: string, amount = 35000, qty = 3) {
    return db.query<{
      order: { id: string; order_number: string; status: string };
    }>(
      "SELECT public.shena_place_order($1::jsonb,$2::jsonb,$3::uuid,$4::jsonb,$5::uuid,$6::bigint) AS order",
      [
        JSON.stringify([{ id: physical, quantity: qty }]),
        JSON.stringify({ departmentId: "centre", communeId: "hinche" }),
        zone,
        JSON.stringify(contact),
        key,
        amount,
      ],
    );
  }
  let orderId = "",
    reviewId = "";
  try {
    await db.exec(setup);
    await db.exec(
      "SELECT set_config('shena.review_context','staging-reviewed',false);BEGIN;",
    );
    await db.exec(
      body(await source("docs/proposals/production-01-admin-reviewed.sql")),
    );
    await db.exec(
      body(await source("docs/proposals/staging/03-commerce-review.sql")),
    );
    await t.test(
      "fonctions désactivées par défaut et anonymes sans accès aux commandes",
      async () => {
        await actor(null);
        assert.equal(
          (
            await db.query<{ n: number }>(
              "SELECT (shena_checkout_features()->>'orders')::boolean::int n",
            )
          ).rows[0].n,
          0,
        );
        await reject(
          () => db.query("SELECT * FROM commerce_orders"),
          /permission denied/,
        );
        await reject(() => place(crypto.randomUUID()), /permission denied/);
        await actor(client);
        await reject(() => place(crypto.randomUUID()), /Commandes désactivées/);
      },
    );
    await t.test(
      "seul admin configure une zone, aucune écriture directe client",
      async () => {
        await actor(client);
        await reject(
          () =>
            db.query(
              "SELECT shena_save_delivery_zone($1,'Zone locale','centre','hinche',5000,true)",
              [zone],
            ),
          /Accès refusé/,
        );
        await actor(adminA);
        await db.query(
          "SELECT shena_save_delivery_zone($1,'Zone locale','centre','hinche',5000,true)",
          [zone],
        );
        await actor(client);
        await reject(
          () => db.query("UPDATE commerce_delivery_zones SET fee_minor=0"),
          /permission denied/,
        );
        await owner();
        await db.exec(
          "UPDATE commerce_settings SET reservation_minutes=60,orders_enabled=true",
        );
      },
    );
    await t.test(
      "le RPC refuse une destination incohérente même avec une zone départementale",
      async () => {
        const broad = crypto.randomUUID();
        await actor(adminA);
        await db.query(
          "SELECT shena_save_delivery_zone($1,'Zone départementale','centre',null,5000,true)",
          [broad],
        );
        await actor(client);
        await reject(
          () =>
            db.query(
              "SELECT shena_place_order($1::jsonb,$2::jsonb,$3,$4::jsonb,$5,15000)",
              [
                JSON.stringify([{ id: physical, quantity: 1 }]),
                JSON.stringify({
                  departmentId: "centre",
                  communeId: "port-au-prince",
                }),
                broad,
                JSON.stringify(contact),
                crypto.randomUUID(),
              ],
            ),
          /Destination non prise en charge/,
        );
      },
    );
    await t.test(
      "montant navigateur falsifié rejeté sans débit de stock ni commande",
      async () => {
        await actor(client);
        await reject(() => place(crypto.randomUUID(), 1), /Montant modifié/);
        await owner();
        assert.equal(
          (
            await db.query<{ stock: number }>(
              "SELECT stock FROM products WHERE id=$1",
              [physical],
            )
          ).rows[0].stock,
          4,
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "SELECT count(*)::int n FROM commerce_orders",
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await t.test(
      "création non payée et requête répétée sans double débit",
      async () => {
        await actor(client);
        const key = crypto.randomUUID();
        const first = (await place(key)).rows[0].order;
        orderId = first.id;
        assert.equal(first.status, "pending_payment");
        assert.ok(first.order_number.startsWith("SH-"));
        assert.equal((await place(key)).rows[0].order.id, orderId);
        await reject(() => place(key, 15000, 1), /Clé déjà utilisée/);
        await owner();
        assert.equal(
          (
            await db.query<{ stock: number }>(
              "SELECT stock FROM products WHERE id=$1",
              [physical],
            )
          ).rows[0].stock,
          1,
        );
      },
    );
    await t.test(
      "stock insuffisant, licence numérique en double et doublons refusés",
      async () => {
        await actor(other);
        await reject(() => place(crypto.randomUUID()), /Stock insuffisant/);
        await reject(
          () =>
            db.query(
              "SELECT shena_place_order($1::jsonb,null,null,$2::jsonb,$3,10000)",
              [
                JSON.stringify([{ id: digital, quantity: 2 }]),
                JSON.stringify(contact),
                crypto.randomUUID(),
              ],
            ),
          /Licence numérique unique/,
        );
        await reject(
          () =>
            db.query(
              "SELECT shena_place_order($1::jsonb,null,null,$2::jsonb,$3,10000)",
              [
                JSON.stringify([
                  { id: digital, quantity: 1 },
                  { id: digital, quantity: 1 },
                ]),
                JSON.stringify(contact),
                crypto.randomUUID(),
              ],
            ),
          /Produit dupliqué/,
        );
      },
    );
    await t.test(
      "isolation des données et impossibilité de déclarer paid via écriture client",
      async () => {
        await actor(other);
        assert.equal(
          (
            await db.query("SELECT id FROM commerce_orders WHERE id=$1", [
              orderId,
            ])
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "SELECT product_id FROM commerce_order_lines WHERE order_id=$1",
              [orderId],
            )
          ).rows.length,
          0,
        );
        await actor(client);
        assert.equal(
          (
            await db.query("SELECT id FROM commerce_orders WHERE id=$1", [
              orderId,
            ])
          ).rows.length,
          1,
        );
        await reject(
          () =>
            db.query("UPDATE commerce_orders SET status='paid' WHERE id=$1", [
              orderId,
            ]),
          /permission denied/,
        );
        await reject(
          () =>
            db.query(
              "SELECT shena_transition_order($1,'processing',1,'Tentative client')",
              [orderId],
            ),
          /Accès refusé/,
        );
        await actor(adminA);
        await reject(
          () =>
            db.query(
              "SELECT shena_transition_order($1,'processing',1,'Préparation sans paiement')",
              [orderId],
            ),
          /Transition interdite/,
        );
      },
    );
    await t.test(
      "paiement manuel verrouillé, montant incorrect et auto-approbation refusés",
      async () => {
        await actor(adminA);
        await reject(
          () =>
            db.query(
              "SELECT shena_submit_payment_review($1,'moncash','REF-SYNTHETIQUE',35000,'Vérification locale du compte',$2)",
              [orderId, crypto.randomUUID()],
            ),
          /Paiements manuels désactivés/,
        );
        await owner();
        await db.exec(
          "UPDATE commerce_settings SET manual_payments_enabled=true",
        );
        await actor(adminA);
        await reject(
          () =>
            db.query(
              "SELECT shena_submit_payment_review($1,'moncash','REF-SYNTHETIQUE',1,'Vérification locale du compte',$2)",
              [orderId, crypto.randomUUID()],
            ),
          /Commande, montant ou délai invalide/,
        );
        const key = crypto.randomUUID();
        reviewId = (
          await db.query<{ id: string }>(
            "SELECT shena_submit_payment_review($1,'moncash','REF-SYNTHETIQUE',35000,'Vérification locale du compte',$2) id",
            [orderId, key],
          )
        ).rows[0].id;
        assert.equal(
          (
            await db.query<{ id: string }>(
              "SELECT shena_submit_payment_review($1,'moncash','REF-SYNTHETIQUE',35000,'Vérification locale du compte',$2) id",
              [orderId, key],
            )
          ).rows[0].id,
          reviewId,
        );
        assert.equal(
          (
            await db.query<{ status: string }>(
              "SELECT status FROM commerce_orders WHERE id=$1",
              [orderId],
            )
          ).rows[0].status,
          "pending_payment",
        );
        await reject(
          () =>
            db.query(
              "SELECT shena_decide_payment_review($1,'approved','Mon propre contrôle est insuffisant')",
              [reviewId],
            ),
          /Second administrateur distinct/,
        );
      },
    );
    await t.test(
      "un contrôle en attente d’un administrateur révoqué ne peut être approuvé",
      async () => {
        await owner();
        await db.query(
          "UPDATE auth.users SET raw_app_meta_data='{}'::jsonb WHERE id=$1",
          [adminA],
        );
        await actor(adminB);
        await reject(
          () =>
            db.query(
              "SELECT shena_decide_payment_review($1,'approved','Contrôle soumis par un compte révoqué')",
              [reviewId],
            ),
          /Second administrateur distinct/,
        );
        await owner();
        await db.query(
          "UPDATE auth.users SET raw_app_meta_data=$2::jsonb WHERE id=$1",
          [adminA, JSON.stringify({ shena_role: "admin" })],
        );
      },
    );
    await t.test(
      "deuxième administrateur, traçabilité et rejeu de paiement refusé",
      async () => {
        await actor(adminB);
        await db.query(
          "SELECT shena_decide_payment_review($1,'approved','Contrôle indépendant synthétique confirmé')",
          [reviewId],
        );
        const row = (
          await db.query<{ status: string; version: number }>(
            "SELECT status,version FROM commerce_orders WHERE id=$1",
            [orderId],
          )
        ).rows[0];
        assert.equal(row.status, "paid");
        assert.equal(row.version, 2);
        assert.equal(
          (
            await db.query<{ metrics: { verifiedRevenueMinor: number } }>(
              "SELECT shena_admin_commerce_metrics() metrics",
            )
          ).rows[0].metrics.verifiedRevenueMinor,
          35000,
        );
        await reject(
          () =>
            db.query(
              "SELECT shena_decide_payment_review($1,'approved','Rejeu interdit du même contrôle')",
              [reviewId],
            ),
          /Second administrateur distinct/,
        );
        await db.query(
          "SELECT shena_transition_order($1,'processing',2,'Préparation après contrôle confirmé')",
          [orderId],
        );
        await reject(
          () =>
            db.query(
              "SELECT shena_transition_order($1,'shipped',2,'Version périmée du formulaire')",
              [orderId],
            ),
          /version modifiée/,
        );
        assert.ok(
          (
            await db.query(
              "SELECT id FROM commerce_audit_events WHERE order_id=$1 AND action='payment.review_approved'",
              [orderId],
            )
          ).rows.length === 1,
        );
      },
    );
    await t.test(
      "annulation non payée restitue le stock une seule fois",
      async () => {
        await actor(other);
        const result = (await place(crypto.randomUUID(), 15000, 1)).rows[0]
          .order;
        await actor(adminA);
        await db.query(
          "SELECT shena_transition_order($1,'cancelled',1,'Annulation synthétique avant paiement')",
          [result.id],
        );
        await reject(
          () =>
            db.query(
              "SELECT shena_transition_order($1,'cancelled',2,'Seconde restitution interdite')",
              [result.id],
            ),
          /Transition interdite/,
        );
        await owner();
        assert.equal(
          (
            await db.query<{ stock: number }>(
              "SELECT stock FROM products WHERE id=$1",
              [physical],
            )
          ).rows[0].stock,
          1,
        );
      },
    );
    await owner();
    await db.exec("ROLLBACK");
    assert.equal(
      (await db.query<{ n: number }>("SELECT count(*)::int n FROM products"))
        .rows[0].n,
      2,
    );
  } finally {
    await db.close();
  }
});

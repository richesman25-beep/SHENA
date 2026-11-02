/** Adaptateur HTTP de test vers PostgreSQL en mémoire ; aucune API distante. */
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const strip = (s) => s.replace(/^BEGIN;\s*$/m, "").replace(/ROLLBACK;\s*$/, "");
export async function createCommerceBackend({
  products,
  adminA,
  adminB,
  client,
  zoneId,
}) {
  const db = await PGlite.create();
  let queue = Promise.resolve();
  const source = (path) =>
    readFile(new URL("../../" + path, import.meta.url), "utf8");
  await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth TO anon,authenticated;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz,raw_app_meta_data jsonb NOT NULL DEFAULT '{}',raw_user_meta_data jsonb NOT NULL DEFAULT '{}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE TABLE products(id uuid PRIMARY KEY,created_at timestamptz NOT NULL,name text NOT NULL,description text,price_htg numeric,product_type text,stock integer,image_url text,active boolean NOT NULL);
 ALTER TABLE products ENABLE ROW LEVEL SECURITY;CREATE POLICY "Public can view active product" ON products FOR SELECT USING(active=true);GRANT ALL ON products TO anon,authenticated;`);
  for (const [id, admin] of [
    [adminA, true],
    [adminB, true],
    [client, false],
  ])
    await db.query(
      "INSERT INTO auth.users(id,email_confirmed_at,raw_app_meta_data) VALUES($1,now(),$2::jsonb)",
      [id, JSON.stringify(admin ? { shena_role: "admin" } : {})],
    );
  for (const p of products)
    await db.query(
      "INSERT INTO products(id,created_at,name,description,price_htg,product_type,stock,image_url,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        p.id,
        p.created_at,
        p.name,
        p.description,
        p.price_htg,
        p.product_type,
        p.stock,
        p.image_url,
        p.active,
      ],
    );
  await db.exec(
    "SELECT set_config('shena.review_context','staging-reviewed',false);BEGIN;",
  );
  await db.exec(
    strip(await source("docs/proposals/production-01-admin-reviewed.sql")),
  );
  await db.exec(
    strip(await source("docs/proposals/staging/03-commerce-review.sql")),
  );
  await db.query(
    "INSERT INTO commerce_delivery_zones(id,name,department_id,commune_id,fee_minor,active) VALUES($1,'Zone synthétique Hinche','centre','hinche',10000,true)",
    [zoneId],
  );
  // Uniquement dans cette base de test éphémère : aucun flag distant modifié.
  await db.exec(
    "UPDATE commerce_settings SET reservation_minutes=60,orders_enabled=true",
  );
  const calls = {
    shena_admin_commerce_metrics: {
      sql: "SELECT public.shena_admin_commerce_metrics() AS value",
      keys: [],
    },
    shena_checkout_features: {
      sql: "SELECT public.shena_checkout_features() AS value",
      keys: [],
    },
    shena_place_order: {
      sql: "SELECT public.shena_place_order($1::jsonb,$2::jsonb,$3::uuid,$4::jsonb,$5::uuid,$6::bigint) AS value",
      keys: [
        "p_lines",
        "p_location",
        "p_zone_id",
        "p_contact",
        "p_idempotency_key",
        "p_expected_total_minor",
      ],
    },
    shena_transition_order: {
      sql: "SELECT public.shena_transition_order($1::uuid,$2,$3::integer,$4) AS value",
      keys: ["p_order_id", "p_status", "p_expected_version", "p_note"],
    },
    shena_save_delivery_zone: {
      sql: "SELECT public.shena_save_delivery_zone($1::uuid,$2,$3,$4,$5::bigint,$6::boolean) AS value",
      keys: [
        "p_id",
        "p_name",
        "p_department_id",
        "p_commune_id",
        "p_fee_minor",
        "p_active",
      ],
    },
    shena_submit_payment_review: {
      sql: "SELECT public.shena_submit_payment_review($1::uuid,$2,$3,$4::bigint,$5,$6::uuid) AS value",
      keys: [
        "p_order_id",
        "p_provider",
        "p_external_reference",
        "p_amount_minor",
        "p_note",
        "p_idempotency_key",
      ],
    },
    shena_decide_payment_review: {
      sql: "SELECT public.shena_decide_payment_review($1::uuid,$2,$3) AS value",
      keys: ["p_review_id", "p_decision", "p_note"],
    },
  };
  const tables = new Set([
    "products",
    "commerce_delivery_zones",
    "commerce_orders",
    "commerce_order_lines",
    "commerce_payment_reviews",
    "commerce_audit_events",
  ]);
  async function run(user, fn) {
    const work = queue.then(async () => {
      await db.exec("SAVEPOINT http_request;RESET ROLE");
      try {
        if (user)
          await db.query(
            "UPDATE auth.users SET raw_app_meta_data=$2::jsonb WHERE id=$1",
            [user.id, JSON.stringify(user.app_metadata || {})],
          );
        await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
          user?.id || "",
        ]);
        await db.exec(
          user ? "SET LOCAL ROLE authenticated" : "SET LOCAL ROLE anon",
        );
        const value = await fn();
        await db.exec("RESET ROLE;RELEASE SAVEPOINT http_request");
        return { status: 200, value };
      } catch (error) {
        await db.exec(
          "ROLLBACK TO SAVEPOINT http_request;RESET ROLE;RELEASE SAVEPOINT http_request",
        );
        return {
          status: error.code === "42501" ? 403 : 400,
          value: {
            code: error.code || "fixture_error",
            message: error.message,
          },
        };
      }
    });
    queue = work.catch(() => {});
    return work;
  }
  return {
    async request(url, method, data, user, single = false) {
      const name = url.pathname.split("/").at(-1);
      if (url.pathname.includes("/rpc/") && calls[name]) {
        const call = calls[name];
        return run(user, async () => {
          const values = call.keys.map((k) =>
            data[k] === undefined
              ? null
              : typeof data[k] === "object" && data[k] !== null
                ? JSON.stringify(data[k])
                : data[k],
          );
          return (await db.query(call.sql, values)).rows[0]?.value ?? null;
        });
      }
      if (!tables.has(name) || method !== "GET") return null;
      return run(user, async () => {
        const select = url.searchParams.get("select") || "*";
        if (!/^(\*|[a-z_]+(,[a-z_]+)*)$/.test(select))
          throw Error("Fixture select invalide");
        const conditions = [],
          params = [];
        for (const [key, value] of url.searchParams) {
          if (["select", "order", "offset", "limit"].includes(key)) continue;
          if (!/^[a-z_]+$/.test(key)) throw Error("Fixture champ invalide");
          if (value.startsWith("eq.")) {
            params.push(value.slice(3));
            conditions.push(`"${key}"=$${params.length}`);
          } else if (value.startsWith("in.(")) {
            params.push(value.slice(4, -1).split(","));
            conditions.push(`"${key}"::text=ANY($${params.length}::text[])`);
          }
        }
        let sql = `SELECT ${
          select === "*"
            ? "*"
            : select
                .split(",")
                .map((s) => '"' + s + '"')
                .join(",")
        } FROM public."${name}"`;
        if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
        const order = url.searchParams.get("order");
        if (order) {
          const fields = order.split(",").map((piece) => {
            const [field, dir] = piece.split(".");
            if (!/^[a-z_]+$/.test(field)) throw Error("Fixture tri invalide");
            return '"' + field + '" ' + (dir === "desc" ? "DESC" : "ASC");
          });
          sql += " ORDER BY " + fields.join(",");
        }
        const limit = Math.min(
            1000,
            Math.max(0, Number(url.searchParams.get("limit") || 1000)),
          ),
          offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
        params.push(limit, offset);
        sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
        const result = (await db.query(sql, params)).rows;
        return single ? result[0] || null : result;
      });
    },
    async close() {
      await queue;
      await db.exec("RESET ROLE;ROLLBACK");
      await db.close();
    },
  };
}

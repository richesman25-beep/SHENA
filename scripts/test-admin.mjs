/** Integration fixture only: normal SDK/auth/actions, no production bypass. */
import { createServer } from "node:https";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { createCommerceBackend } from "../tests/fixtures/commerce-backend.mjs";
import { chromium, expect } from "@playwright/test";
const temp = await mkdtemp(join(tmpdir(), "shena-admin-"));
const originalTs = await readFile("tsconfig.json", "utf8");
const originalNextEnv = await readFile("next-env.d.ts", "utf8").catch(
  () => null,
);
const password = randomBytes(24).toString("hex"); // Ephemeral, never printed or stored in Git.
let browser, next, commerceBackend, commerceBackendReady;
let enableCommerceFixture = false;
let missingMigrations = false;
const stagingOrigin = "https://prqmomjtmyhqijysfoog.supabase.co";
const commerceZoneId = randomUUID();
const logs = [];
const uid = randomUUID(),
  memberId = randomUUID(),
  secondAdminId = randomUUID();
let rows = [
  {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    name: "Produit local de test",
    description: "Fixture isolée",
    price_htg: 500,
    product_type: "physical",
    stock: 5,
    image_url: null,
    active: true,
  },
  {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    name: "E-book local",
    description: "Fixture numérique",
    price_htg: 100,
    product_type: "digital",
    stock: 0,
    image_url: null,
    active: false,
  },
];
const users = new Map(),
  revoked = new Set();
const storage = new Map();
const recoveryHash = randomBytes(32).toString("hex");
let passwordUpdates = 0;
let recoveryCount = 0,
  uploads = 0,
  denied = 0;
function session(admin = true, second = false) {
  const user = {
    id: admin ? (second ? secondAdminId : uid) : memberId,
    email: admin
      ? second
        ? "admin-b@example.test"
        : "admin@example.test"
      : "member@example.test",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: admin ? { shena_role: "admin" } : {},
    user_metadata: admin ? {} : { shena_role: "admin" },
    created_at: new Date().toISOString(),
    email_confirmed_at: new Date().toISOString(),
  };
  const b64 = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), app_metadata: user.app_metadata })}.${randomBytes(32).toString("base64url")}`;
  users.set(token, user);
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: randomUUID(),
    user,
  };
}
const caps = {
  version: 2,
  products: true,
  categories: false,
  images: true,
  digital: true,
  mediaManage: false,
  mediaDelete: false,
  digitalMetadata: false,
  extendedDigitalUploads: false,
  audit: false,
};
const fixture = createServer({}, () => {});
try {
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      join(temp, "key.pem"),
      "-out",
      join(temp, "cert.pem"),
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ],
    { stdio: "ignore" },
  );
  fixture.setSecureContext({
    key: await readFile(join(temp, "key.pem")),
    cert: await readFile(join(temp, "cert.pem")),
  });
  fixture.removeAllListeners("request");
  fixture.on("request", async (req, res) => {
    const url = new URL(req.url, "https://localhost");
    let body = "";
    for await (const chunk of req) body += chunk;
    let data;
    try {
      data = body ? JSON.parse(body) : {};
    } catch {
      data = {};
    }
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    const user = !revoked.has(token) && users.get(token);
    const admin = user?.app_metadata.shena_role === "admin";
    const send = (status, value) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(value));
    };
    if (url.pathname === "/auth/v1/token" && data.password === password)
      return send(
        200,
        session(
          ["admin@example.test", "admin-b@example.test"].includes(data.email),
          data.email === "admin-b@example.test",
        ),
      );
    if (url.pathname === "/auth/v1/token")
      return send(400, {
        error: "invalid_grant",
        error_description: "Invalid credentials",
      });
    if (
      url.pathname === "/auth/v1/verify" &&
      data.token_hash === recoveryHash &&
      data.type === "recovery"
    )
      return send(200, session(true));
    if (url.pathname === "/auth/v1/user") {
      if (!user) return send(401, { msg: "Unauthorized" });
      if (req.method === "PUT" && data.password) passwordUpdates++;
      return send(200, user);
    }
    if (url.pathname === "/auth/v1/logout") {
      revoked.add(token);
      res.writeHead(204);
      return res.end();
    }
    if (url.pathname === "/auth/v1/recover") {
      recoveryCount++;
      return send(200, {});
    }
    if (missingMigrations && url.pathname.startsWith("/rest/v1/rpc/shena_"))
      return send(404, {
        code: "PGRST202",
        message: "Function absent in isolated fixture",
      });
    if (url.pathname === "/rest/v1/rpc/shena_admin_status")
      return admin ? send(200, caps) : send(403, { message: "Denied" });
    if (
      url.pathname === "/rest/v1/rpc/shena_checkout_features" &&
      !enableCommerceFixture
    )
      return send(200, {
        version: 1,
        delivery: false,
        orders: false,
        manualPayments: false,
      });
    if (
      url.pathname === "/rest/v1/rpc/shena_checkout_features" &&
      !commerceBackend
    ) {
      commerceBackendReady ||= createCommerceBackend({
        products: rows,
        adminA: uid,
        adminB: secondAdminId,
        client: memberId,
        zoneId: commerceZoneId,
      });
      commerceBackend = await commerceBackendReady;
    }
    if (
      commerceBackend &&
      ((url.pathname.includes("/rpc/shena_") &&
        !url.pathname.endsWith("shena_admin_status") &&
        !url.pathname.endsWith("shena_catalog_features")) ||
        url.pathname.includes("/rest/v1/commerce_") ||
        (url.pathname === "/rest/v1/products" && req.method === "GET"))
    ) {
      const result = await commerceBackend.request(
        url,
        req.method,
        data,
        user,
        req.headers.accept?.includes("vnd.pgrst.object"),
      );
      if (result) return send(result.status, result.value);
    }
    if (url.pathname === "/rest/v1/products") {
      const matches = (row) =>
        [...url.searchParams].every(([key, value]) => {
          if (["select", "order", "offset", "limit"].includes(key)) return true;
          if (value.startsWith("eq."))
            return String(row[key]) === value.slice(3);
          if (value === "is.null") return row[key] === null;
          return true;
        });
      if (req.method === "GET") {
        let result = rows.filter((r) => (admin || r.active) && matches(r));
        const range = req.headers.range?.match(/(\d+)-(\d+)/);
        if (range)
          result = result.slice(Number(range[1]), Number(range[2]) + 1);
        const single = req.headers.accept?.includes("vnd.pgrst.object");
        return send(200, single ? result[0] || null : result);
      }
      if (!admin) {
        denied++;
        return send(403, { code: "42501", message: "RLS denied" });
      }
      if (req.method === "POST") {
        rows.push({ ...data, image_url: null });
        return send(201, data);
      }
      if (req.method === "PATCH") {
        const selected = rows.filter(matches);
        selected.forEach((r) => Object.assign(r, data));
        return send(
          200,
          req.headers.accept?.includes("vnd.pgrst.object")
            ? selected[0] || null
            : selected,
        );
      }
    }
    if (url.pathname === "/rest/v1/digital_assets") {
      if (!admin) return send(403, { message: "RLS denied" });
      return send(200, []);
    }
    if (url.pathname.startsWith("/storage/v1/object/")) {
      const path = url.pathname.replace("/storage/v1/object/", "");
      if (path.startsWith("public/digital-")) {
        denied++;
        return send(403, { message: "Private bucket" });
      }
      if (!admin) {
        denied++;
        return send(403, { message: "Storage RLS denied" });
      }
      if (req.method === "POST") {
        uploads++;
        storage.set(path, body);
        return send(200, { Key: path });
      }
      return send(200, {});
    }
    return send(404, { message: "Fixture route not implemented" });
  });
  await new Promise((resolve) => fixture.listen(0, "127.0.0.1", resolve));
  const api = `https://localhost:${fixture.address().port}`;
  const env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: stagingOrigin,
    SHENA_DEPLOYMENT_TARGET: "staging",
    SHENA_STAGING_PROJECT_REF: "prqmomjtmyhqijysfoog",
    SHENA_CHECKOUT_MODE: "staging",
    VERCEL_ENV: "development",
    SHENA_FIXTURE_API_ORIGIN: api,
    NODE_OPTIONS: `--import=${new URL("./staging-fixture-transport.mjs", import.meta.url).href}`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_fixture_only",
    SHENA_SITE_URL: "http://127.0.0.1:3101",
    SHENA_ADMIN_TEST_BUILD: "1",
    SHENA_CATALOG_MODE: "live",
    NODE_EXTRA_CA_CERTS: join(temp, "cert.pem"),
    NEXT_TELEMETRY_DISABLED: "1",
  };
  next = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3101",
    ],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [next.stdout, next.stderr])
    stream.on("data", (chunk) => logs.push(String(chunk)));
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch("http://127.0.0.1:3101/admin/connexion")).ok) break;
    } catch {}
    if (i === 119) throw Error("Next startup timeout");
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext();
  await context.route(
    stagingOrigin + "/storage/v1/object/public/product-images/**",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const base = "http://127.0.0.1:3101";
  const check = async (name, fn) => {
    await fn();
    console.log(`PASS ${name}`);
  };
  async function seedCheckout(target, id, quantity) {
    // Un document sans React empêche CartProvider de réécrire le stockage
    // pendant son hydratation. La destination lit la fixture avant de monter.
    await target.goto(base + "/robots.txt");
    await target.evaluate(
      ({ id, quantity }) =>
        localStorage.setItem(
          "shena.cart.v1.live",
          JSON.stringify([{ id, quantity }]),
        ),
      { id, quantity },
    );
    await target.goto(base + "/commander");
    await expect(
      target.getByRole("combobox", { name: "Département", exact: true }),
    ).toBeVisible();
  }
  async function login(email) {
    await page.goto(base + "/admin/connexion");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Se connecter", exact: true })
      .click();
  }
  await check("anonymous routes stay protected", async () => {
    await page.goto(base + "/admin/products");
    await expect(page).toHaveURL(/\/admin\/connexion$/);
    assert.equal(await page.locator("input[name=price_htg]").count(), 0);
  });
  await check("user_metadata admin does not authorize a member", async () => {
    await login("member@example.test");
    await expect(page.locator(".admin-error[role=alert]")).toContainText(
      "pas autorisé",
    );
  });
  await check("verified admin login and real fixture counters", async () => {
    await login("admin@example.test");
    await expect(page).toHaveURL(base + "/admin");
    await expect(
      page.getByRole("heading", { name: "Tableau de bord", exact: true }),
    ).toBeVisible();
    assert.ok(
      (await context.cookies()).some((c) => c.httpOnly && c.sameSite === "Lax"),
    );
    await expect(page.locator(".admin-metric").first()).toContainText("2");
  });
  await check(
    "missing migrations lock server writes while catalogue remains available",
    async () => {
      await page.goto(base + "/admin/products/new");
      await page
        .getByLabel("Nom du produit", { exact: true })
        .fill("Ne doit pas être enregistré");
      await page.getByLabel("Prix en HTG").fill("120.50");
      await page.getByLabel("Stock global").fill("3");
      const before = JSON.stringify(rows);
      missingMigrations = true;
      try {
        await page
          .getByRole("button", { name: "Créer le produit", exact: true })
          .click();
        await expect(
          page.locator(".product-editor-form .admin-error"),
        ).toContainText("structures nécessaires");
        assert.equal(JSON.stringify(rows), before);
        await page.reload();
        await expect(
          page.getByRole("button", { name: "Créer le produit", exact: true }),
        ).toBeDisabled();
        await expect(page.locator(".admin-notice")).toContainText(
          "écritures verrouillées",
        );
        await page.goto(base + "/boutique");
        await expect(page.locator(".product-card")).toHaveCount(1);
        await expect(page.locator(".product-card")).toContainText(rows[0].name);
        const response = await page.request.post(base + "/api/cart/quote", {
          data: { lines: [{ id: rows[0].id, quantity: 1 }] },
        });
        assert.equal(response.status(), 200);
        assert.equal((await response.json()).quote.canOrder, false);
        const download = await page.request.get(
          base + `/api/digital/${rows[0].id}/download?paid=true`,
        );
        assert.equal(download.status(), 404);
        assert.equal(download.headers().location, undefined);
        await page.goto(base + "/admin/digital/releases");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "Versions numériques indisponibles",
        );
        await expect(page.locator('input[name="sha256"]')).toHaveCount(0);
        assert.equal(JSON.stringify(rows), before);
      } finally {
        missingMigrations = false;
      }
    },
  );
  await check("create product through server action", async () => {
    await page.goto(base + "/admin/products/new");
    await page
      .getByLabel("Nom du produit", { exact: true })
      .fill("Article créé localement");
    await page.getByLabel("Prix en HTG").fill("120.50");
    await page.getByLabel("Stock global").fill("3");
    await page
      .getByRole("button", { name: "Créer le produit", exact: true })
      .click();
    await expect(page.locator(".admin-success[role=status]")).toContainText(
      "Produit créé",
    );
    assert.equal(rows.length, 3);
    assert.equal(rows[2].active, false);
    await page.getByRole("link", { name: "Ouvrir le produit créé" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Article créé localement",
    );
  });
  await check("edit price and stock, reject stale revision", async () => {
    await page.getByLabel("Prix en HTG").fill("140");
    await page
      .getByRole("button", {
        name: "Enregistrer les modifications",
        exact: true,
      })
      .click();
    await expect(
      page.locator(".admin-success[role=status]").first(),
    ).toContainText("enregistré");
    assert.equal(rows[2].price_htg, 140);
    await page.reload();
    rows[2].stock = 8;
    await page.getByLabel("Prix en HTG").fill("150");
    await page
      .getByRole("button", {
        name: "Enregistrer les modifications",
        exact: true,
      })
      .click();
    await expect(
      page.locator(".admin-error[role=alert]").first(),
    ).toContainText("modifié");
    assert.equal(rows[2].price_htg, 140);
    await page.reload();
  });
  await check(
    "publication and archive retain product/dependencies",
    async () => {
      await page.getByLabel("Confirmer le nom du produit").fill(rows[2].name);
      await page
        .getByRole("button", { name: "Publier le produit", exact: true })
        .click();
      await expect(
        page.locator(".admin-success[role=status]").last(),
      ).toContainText("publié");
      assert.equal(rows[2].active, true);
      await page.reload();
      await page.getByLabel("Confirmer le nom du produit").fill(rows[2].name);
      await page
        .getByRole("button", {
          name: "Dépublier / archiver du catalogue",
          exact: true,
        })
        .click();
      await expect(
        page.locator(".admin-success[role=status]").last(),
      ).toContainText("dépublié");
      assert.equal(rows.length, 3);
      assert.equal(rows[2].active, false);
    },
  );
  await check("image upload validates bytes before Storage", async () => {
    await page.getByLabel("Nouvelle image").setInputFiles({
      name: "fake.png",
      mimeType: "image/png",
      buffer: Buffer.from("<svg/>"),
    });
    await page.getByRole("button", { name: "Téléverser et choisir" }).click();
    await expect(page.locator(".image-upload-form [role=alert]")).toBeVisible();
    assert.equal(uploads, 0);
    const sharp = (await import("sharp")).default;
    const png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: "#2457c6" },
    })
      .png()
      .toBuffer();
    await page
      .getByLabel("Nouvelle image")
      .setInputFiles({ name: "image.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Téléverser et choisir" }).click();
    await expect(
      page.locator(".image-upload-form [role=status]"),
    ).toContainText("WebP");
    assert.equal(uploads, 1);
    assert.ok(rows[2].image_url.endsWith(".webp"));
  });
  await check(
    "digital file upload stays quarantined without customer link",
    async () => {
      await page.goto(base + "/admin/digital");
      await page.getByLabel("Fichier numérique privé").setInputFiles({
        name: "ebook.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7 isolated fixture"),
      });
      await page
        .getByRole("button", {
          name: "Placer le fichier en quarantaine privée",
          exact: true,
        })
        .click();
      await expect(page.locator(".admin-success[role=status]")).toContainText(
        "quarantaine privée",
      );
      assert.equal(uploads, 2);
      assert.equal(
        await page
          .locator('a[href*="digital-quarantine"], a[href*="/object/sign/"]')
          .count(),
        0,
      );
    },
  );
  await check("search, preview and mobile workspace", async () => {
    await page.goto(base + "/admin/products?q=créé&status=inactive");
    await expect(page.locator(".admin-products-table tbody tr")).toHaveCount(1);
    await page.goto(base + `/admin/products/${rows[2].id}/preview`);
    await expect(page.locator(".admin-product-preview")).toContainText(
      "Article créé",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/admin");
    await expect(
      page.getByRole("navigation", { name: "Administration", exact: true }),
    ).toBeVisible();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "Mobile viewport must not overflow",
    );
    await mkdir("test-results", { recursive: true });
    await page.screenshot({
      path: "test-results/admin-mobile.png",
      fullPage: true,
      caret: "initial",
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: "test-results/admin-desktop.png",
      fullPage: true,
      caret: "initial",
    });
  });
  await check("password recovery request goes only to fixture", async () => {
    await page.goto(base + "/admin/mot-de-passe-oublie");
    await page
      .getByLabel("E-mail du compte", { exact: true })
      .fill("admin@example.test");
    await page
      .getByRole("button", {
        name: "Recevoir un lien de récupération",
        exact: true,
      })
      .click();
    await expect(page.locator(".admin-success[role=status]")).toContainText(
      "Si cette adresse",
    );
    assert.equal(recoveryCount, 1);
  });
  await check(
    "private buckets and unauthorized writes denied by fixture contract",
    async () => {
      // Transport contract, not a claim about production RLS.
      const https = await import("node:https");
      const request = (path, method = "GET") =>
        new Promise((resolve, reject) => {
          const req = https.request(
            api + path,
            { method, ca: execFileSync("cat", [join(temp, "cert.pem")]) },
            (res) => {
              res.resume();
              resolve(res.statusCode);
            },
          );
          req.on("error", reject);
          req.end();
        });
      assert.equal(
        await request("/storage/v1/object/public/digital-products/paid.pdf"),
        403,
      );
      assert.equal(await request("/rest/v1/products", "POST"), 403);
      assert.equal(
        await request(
          "/storage/v1/object/product-images/unauthorized.webp",
          "POST",
        ),
        403,
      );
      assert.equal(denied, 3);
    },
  );
  let stagedOrderId = "";
  await check(
    "server quote ignores browser price and paid flags, rejects invalid bodies",
    async () => {
      rows[1].active = true;
      enableCommerceFixture = true;
      const response = await context.request.post(base + "/api/cart/quote", {
        data: {
          lines: [{ id: rows[0].id, quantity: 2, price: 1 }],
          paid: true,
          total: 1,
        },
      });
      assert.equal(response.status(), 200);
      const result = await response.json();
      assert.equal(result.quote.subtotalMinor, 100000);
      assert.equal(result.quote.totalMinor, null);
      assert.equal(result.quote.canOrder, false);
      const invalid = await context.request.post(base + "/api/cart/quote", {
        data: {
          lines: [
            { id: rows[0].id, quantity: 1 },
            { id: rows[0].id, quantity: 1 },
          ],
        },
      });
      assert.equal(invalid.status(), 422);
      const large = await context.request.post(base + "/api/cart/quote", {
        headers: { "Content-Type": "application/json" },
        data: '"' + "x".repeat(17000) + '"',
      });
      assert.equal(large.status(), 413);
    },
  );
  await check(
    "checkout creates an unpaid order through Next actions SDK and local PostgreSQL",
    async () => {
      await seedCheckout(page, rows[0].id, 2);
      await page
        .getByLabel("Département", { exact: true })
        .selectOption("centre");
      await page.getByLabel("Commune prise en charge").selectOption("hinche");
      await page
        .getByLabel("Zone de livraison", { exact: true })
        .selectOption(commerceZoneId);
      await page
        .getByRole("button", {
          name: "Vérifier les prix côté serveur",
          exact: true,
        })
        .click();
      await expect(page.locator(".checkout-quote")).toContainText("1 100 HTG");
      await page.getByLabel("Nom complet").fill("Client du test navigateur");
      await page
        .getByLabel("Téléphone", { exact: true })
        .fill("+509 1234 5678");
      await page
        .getByLabel("Adresse de livraison", { exact: true })
        .fill("Adresse fictive de staging local");
      await page.locator("input[name=confirmed]").check();
      await page
        .getByRole("button", {
          name: "Enregistrer la commande non payée",
          exact: true,
        })
        .click();
      await expect(
        page.locator(".checkout-contact [role=status]"),
      ).toContainText("en attente de paiement");
      const href = await page
        .getByRole("link", { name: "Voir le suivi", exact: true })
        .getAttribute("href");
      stagedOrderId = href.split("/").at(-1);
      await page
        .getByRole("link", { name: "Voir le suivi", exact: true })
        .click();
      await expect(page.locator(".order-detail")).toContainText(
        "En attente de paiement",
      );
      await expect(
        page.locator('a[download],a[href*="/object/sign/"]'),
      ).toHaveCount(0);
    },
  );
  await check(
    "admin follows actual local order and cannot approve a disabled payment",
    async () => {
      await page.goto(base + "/admin/commandes");
      await expect(page.locator("tbody tr")).toHaveCount(1);
      await page.getByRole("link", { name: "Ouvrir →", exact: true }).click();
      await expect(page.locator(".order-detail")).toContainText(
        "En attente de paiement",
      );
      await expect(
        page.getByRole("button", {
          name: "Soumettre au second administrateur",
          exact: true,
        }),
      ).toBeDisabled();
      await page.goto(base + "/admin/livraisons");
      await expect(
        page.getByRole("heading", {
          name: "Zone synthétique Hinche",
          exact: true,
        }),
      ).toBeVisible();
    },
  );
  await check(
    "customer login digital order and owner-only tracking at mobile width",
    async () => {
      const buyerContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const buyer = await buyerContext.newPage();
      await buyer.goto(base + "/compte/connexion");
      await buyer
        .getByLabel("E-mail", { exact: true })
        .fill("member@example.test");
      await buyer.getByLabel("Mot de passe", { exact: true }).fill(password);
      await buyer
        .getByRole("button", {
          name: "Me connecter pour commander",
          exact: true,
        })
        .click();
      await expect(buyer).toHaveURL(base + "/commander");
      await seedCheckout(buyer, rows[1].id, 1);
      await buyer
        .getByRole("button", {
          name: "Vérifier les prix côté serveur",
          exact: true,
        })
        .click();
      await expect(buyer.locator(".checkout-quote")).toContainText("100 HTG");
      await buyer.getByLabel("Nom complet").fill("Acheteur numérique local");
      await buyer
        .getByLabel("Téléphone", { exact: true })
        .fill("+509 8765 4321");
      await buyer.locator("input[name=confirmed]").check();
      assert.ok(
        await buyer.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await buyer.screenshot({
        path: "test-results/checkout-mobile.png",
        fullPage: true,
        caret: "initial",
      });
      await buyer
        .getByRole("button", {
          name: "Enregistrer la commande non payée",
          exact: true,
        })
        .click();
      await expect(
        buyer.locator(".checkout-contact [role=status]"),
      ).toContainText("en attente de paiement");
      await buyer
        .getByRole("link", { name: "Voir le suivi", exact: true })
        .click();
      await expect(buyer.locator(".order-detail")).toContainText(
        "En attente de paiement",
      );
      await buyer.goto(buyer.url() + "?paid=true&payment_status=success");
      await expect(buyer.locator(".order-detail")).toContainText(
        "En attente de paiement",
      );
      await expect(
        buyer.locator('a[download],a[href*="/object/sign/"]'),
      ).toHaveCount(0);
      await buyer.goto(base + "/compte/commandes/" + stagedOrderId);
      await expect(buyer.getByRole("heading", { level: 1 })).toHaveText(
        "Cette page reste à découvrir.",
      );
      await buyer.goto(base + "/admin/commandes");
      await expect(buyer.getByRole("heading", { level: 1 })).toHaveText(
        "Accès refusé",
      );
      await buyerContext.close();
    },
  );
  await check(
    "a second separate admin can authenticate and view the two local orders",
    async () => {
      const secondContext = await browser.newContext();
      const second = await secondContext.newPage();
      await second.goto(base + "/admin/connexion");
      await second
        .getByLabel("E-mail", { exact: true })
        .fill("admin-b@example.test");
      await second.getByLabel("Mot de passe", { exact: true }).fill(password);
      await second
        .getByRole("button", { name: "Se connecter", exact: true })
        .click();
      await expect(second).toHaveURL(base + "/admin");
      await second.goto(base + "/admin/commandes");
      await expect(second.locator("tbody tr")).toHaveCount(2);
      await secondContext.close();
    },
  );
  await check(
    "role revoked after login cannot write through a server action",
    async () => {
      await page.goto(base + `/admin/products/${rows[2].id}`);
      for (const u of users.values())
        if (u.id === uid) {
          u.app_metadata = {};
          u.user_metadata = { shena_role: "admin" };
        }
      await page.getByLabel("Prix en HTG").fill("999");
      await page
        .getByRole("button", {
          name: "Enregistrer les modifications",
          exact: true,
        })
        .click();
      await expect(
        page.locator(".product-editor-form .admin-error"),
      ).toContainText("refusé");
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Accès refusé",
      );
      assert.equal(rows[2].price_htg, 140);
      await login("admin@example.test");
      await expect(page).toHaveURL(base + "/admin");
    },
  );
  await check(
    "recovery token callback and password change with global signout",
    async () => {
      await page.goto(
        base +
          "/admin/auth/confirm?token_hash=" +
          recoveryHash +
          "&type=recovery&next=https://evil.test",
      );
      await expect(page).toHaveURL(base + "/admin/mot-de-passe");
      await page
        .locator("input[name=password]")
        .fill(randomBytes(24).toString("hex"));
      const fresh = await page.locator("input[name=password]").inputValue();
      await page.locator("input[name=confirmation]").fill(fresh);
      await page.getByRole("button", { name: /Enregistrer/ }).click();
      await expect(page).toHaveURL(/password=updated/);
      assert.equal(passwordUpdates, 1);
      await login("admin@example.test");
      await expect(page).toHaveURL(base + "/admin");
    },
  );
  await check("logout clears access", async () => {
    await page.goto(base + "/admin");
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/admin\/connexion$/);
    await page.goto(base + "/admin/products");
    await expect(page).toHaveURL(/\/admin\/connexion$/);
  });
  console.log(
    "Admin integration complete: isolated local fixture only; no production Supabase writes.",
  );
} catch (error) {
  if (browser) {
    const failed = browser
      .contexts()
      .flatMap((c) => c.pages())
      .find((p) => !p.isClosed());
    if (failed) {
      await mkdir("test-results", { recursive: true });
      await writeFile(
        "test-results/admin-failure.txt",
        await failed
          .locator("body")
          .innerText()
          .catch(() => "Unavailable"),
      );
      await failed
        .screenshot({
          path: "test-results/admin-failure.png",
          fullPage: true,
          caret: "initial",
        })
        .catch(() => {});
    }
  }
  console.error(error);
  console.error(logs.join("").slice(-10000));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await commerceBackend?.close();
  next?.kill("SIGTERM");
  fixture.closeAllConnections();
  await new Promise((resolve) => fixture.close(resolve));
  if (next)
    await new Promise((resolve) => {
      next.once("exit", resolve);
      setTimeout(resolve, 3000).unref();
    });
  await writeFile("tsconfig.json", originalTs);
  if (originalNextEnv !== null)
    await writeFile("next-env.d.ts", originalNextEnv);
  await rm(temp, { recursive: true, force: true });
}

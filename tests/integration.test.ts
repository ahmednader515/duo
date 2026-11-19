import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Opt-in only: creates and deletes disposable records on a LOOPBACK test database.
const enabled = process.env.DUO_RUN_DB_TESTS === "1";
test(
  "isolated database: authentication, CRUD, roles, tenant foreign keys, and session revocation",
  { skip: !enabled },
  async () => {
    const database = new URL(process.env.DATABASE_URL!);
    assert.ok(
      ["127.0.0.1", "localhost"].includes(database.hostname),
      "Use a disposable loopback database only",
    );
    const base = "http://localhost:3000";
    const require = createRequire(import.meta.url);
    const { encodeReply } =
      require("next/dist/compiled/react-server-dom-turbopack/client.browser") as {
        encodeReply(args: unknown[]): Promise<string | FormData>;
      };
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: database.toString(), max: 1 }),
    });
    const suffix = crypto.randomUUID().slice(0, 8);
    const password = "Disposable-test-only-2026";
    const email = `owner-${suffix}@duo.test`;
    const otherEmail = `other-${suffix}@duo.test`;
    class Session {
      jar = new Map<string, string>();
      async request(path: string, init: RequestInit = {}) {
        const response = await fetch(`${base}${path}`, {
          ...init,
          redirect: "manual",
          headers: {
            origin: base,
            cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "),
            ...init.headers,
          },
        });
        for (const item of response.headers.getSetCookie()) {
          const pair = item.split(";")[0];
          const index = pair.indexOf("=");
          this.jar.set(pair.slice(0, index), pair.slice(index + 1));
        }
        return response;
      }
      async login(address: string, secret = password) {
        const csrf = await (await this.request("/api/auth/csrf")).json();
        const response = await this.request("/api/auth/callback/credentials", {
          method: "POST",
          body: new URLSearchParams({
            csrfToken: csrf.csrfToken,
            email: address,
            password: secret,
            json: "true",
            callbackUrl: `${base}/dashboard`,
          }),
        });
        assert.equal(response.status, 200);
      }
      async action(name: string, args: unknown[]) {
        const manifest = JSON.parse(
          readFileSync(
            ".next/dev/server/server-reference-manifest.json",
            "utf8",
          ),
        ) as {
          node: Record<
            string,
            {
              exportedName?: string;
              workers: Record<string, { moduleId: string }>;
            }
          >;
        };
        // Development-only action discovery keeps the test independent of generated IDs.
        const entry = Object.entries(manifest.node).find(
          ([, v]) =>
            v.exportedName === name ||
            Object.values(v.workers).some((w) =>
              w.moduleId.includes(`\"${name}\"`),
            ),
        );
        assert.ok(entry, `Compiled server action ${name} must be discoverable`);
        const body = await encodeReply(args);
        return this.request("/dashboard/products", {
          method: "POST",
          headers: { "Next-Action": entry[0] },
          body,
        });
      }
    }
    try {
      const owner = new Session(),
        other = new Session();
      assert.equal((await owner.request("/dashboard")).status, 307);
      assert.equal(
        (await owner.request("/api/uploads", { method: "POST" })).status,
        401,
      );
      assert.equal(
        (
          await owner.request("/api/register", {
            method: "POST",
            headers: { origin: "https://untrusted.example" },
          })
        ).status,
        403,
      );
      for (const [session, address] of [
        [owner, email],
        [other, otherEmail],
      ] as const) {
        const response = await session.request("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "QA owner",
            workspace: "Isolated QA workspace",
            email: address,
            password,
          }),
        });
        assert.equal(response.status, 201);
        await session.login(address);
      }
      const user = await db.user.findUniqueOrThrow({
        where: { email },
        include: { memberships: true },
      });
      const otherUser = await db.user.findUniqueOrThrow({
        where: { email: otherEmail },
        include: { memberships: true },
      });
      const workspaceId = user.memberships[0].workspaceId,
        otherWorkspace = otherUser.memberships[0].workspaceId;
      assert.notEqual(workspaceId, otherWorkspace);
      assert.notEqual(user.passwordHash, password);
      assert.equal(
        (await owner.request("/dashboard/products/new")).status,
        200,
      );
      const categoryResponse = await owner.action("createCategory", [
        "QA category",
      ]);
      assert.equal(categoryResponse.status, 200);
      const category = await db.category.findFirstOrThrow({
        where: { workspaceId },
      });
      const form = new FormData();
      Object.entries({
        name: "QA travel bag",
        description: "A real test product",
        sku: `qa-${suffix}`,
        barcode: "",
        categoryId: category.id,
        price: "159.99",
        compareAtPrice: "189.99",
        currency: "SAR",
        stock: "7",
        weight: "0.5",
        length: "20",
        width: "10",
        height: "30",
        status: "DRAFT",
      }).forEach(([k, v]) => form.set(k, v));
      assert.equal(
        (await owner.action("saveProduct", [null, form])).status,
        200,
      );
      const product = await db.product.findFirstOrThrow({
        where: { workspaceId },
      });
      assert.equal(product.price.toString(), "159.99");
      assert.equal(product.stock, 7);
      const foreignUpload = new FormData();
      foreignUpload.set("productId", product.id);
      foreignUpload.set(
        "file",
        new Blob(["invalid"], { type: "image/png" }),
        "bad.png",
      );
      assert.equal(
        (
          await other.request("/api/uploads", {
            method: "POST",
            body: foreignUpload,
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await owner.request("/api/uploads", {
            method: "POST",
            body: foreignUpload,
          })
        ).status,
        400,
      );
      // Next may have sent streaming layout headers before notFound(), yielding HTTP 200.
      const denied = await (
        await other.request(`/dashboard/products/${product.id}`)
      ).text();
      assert.match(denied, /Page not found/);
      assert.ok(!denied.includes("A real test product"));
      assert.equal(
        (
          await owner.request(
            `/dashboard/products?q=travel&status=DRAFT&category=${category.id}&sort=price_asc`,
          )
        ).status,
        200,
      );
      form.set("name", "QA edited bag");
      form.set("status", "ACTIVE");
      assert.equal(
        (await owner.action("saveProduct", [product.id, form])).status,
        200,
      );
      assert.equal(
        (await db.product.findUniqueOrThrow({ where: { id: product.id } }))
          .status,
        "ACTIVE",
      );
      await other.action("removeProduct", [product.id]);
      assert.ok(await db.product.findUnique({ where: { id: product.id } }));
      const foreignCategory = await db.category.create({
        data: { workspaceId: otherWorkspace, name: "Foreign", slug: "foreign" },
      });
      await assert.rejects(
        db.product.update({
          where: { id: product.id },
          data: { categoryId: foreignCategory.id },
        }),
      );
      await db.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: user.id } },
        data: { role: "MEMBER" },
      });
      await owner.action("removeProduct", [product.id]);
      assert.ok(await db.product.findUnique({ where: { id: product.id } }));
      await db.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: user.id } },
        data: { role: "OWNER" },
      });
      assert.equal(
        (await owner.action("removeProduct", [product.id])).status,
        200,
      );
      assert.equal(
        await db.product.findUnique({ where: { id: product.id } }),
        null,
      );
      assert.ok(
        await db.activityLog.count({
          where: { workspaceId, action: "PRODUCT_DELETED" },
        }),
      );
      assert.equal((await owner.request("/dashboard/settings")).status, 200);
      const workspaceForm = new FormData();
      workspaceForm.set("name", "Updated QA workspace");
      await owner.action("updateSettings", ["workspace", workspaceForm]);
      assert.equal(
        (await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } }))
          .name,
        "Updated QA workspace",
      );
      const passwordForm = new FormData();
      passwordForm.set("currentPassword", password);
      passwordForm.set("password", `${password}-changed`);
      await owner.action("updateSettings", ["password", passwordForm]);
      assert.equal(
        (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
          .sessionVersion,
        1,
      );
      assert.equal((await owner.request("/dashboard")).status, 307);
      await owner.login(email, `${password}-changed`);
      assert.equal((await owner.request("/dashboard")).status, 200);
    } finally {
      // Only records created by this test run. Never resets or truncates a database.
      const users = await db.user.findMany({
        where: { email: { in: [email, otherEmail] } },
        select: { id: true },
      });
      for (const user of users) {
        await db.workspace.deleteMany({ where: { ownerId: user.id } });
        await db.user.delete({ where: { id: user.id } });
      }
      await db.$disconnect();
    }
  },
);

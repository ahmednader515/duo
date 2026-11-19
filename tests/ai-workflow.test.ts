import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresConnectionString } from "../src/lib/database-url";

// Exercises approval and storage with explicit test fixtures, without spending API credits.
// All records and objects belong to a temporary test account and are removed afterward.
test(
  "AI approval and R2 workflow: edited content, image apply, idempotency, roles, and tenant isolation",
  { skip: process.env.DUO_RUN_AI_WORKFLOW_TESTS !== "1", timeout: 120000 },
  async () => {
    const db = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: postgresConnectionString(process.env.DATABASE_URL!),
        max: 2,
      }),
    });
    const r2 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    const email = `ai-workflow-${randomUUID()}@example.invalid`,
      otherEmail = `ai-other-${randomUUID()}@example.invalid`,
      password = randomUUID() + randomUUID();
    const jar = new Map<string, string>();
    let workspaceId: string | undefined;
    let otherWorkspaceId: string | undefined;
    let key: string | undefined;
    const base = "http://localhost:3000";
    async function request(path: string, body?: unknown) {
      const response = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Origin: base,
          Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
          ...(body instanceof URLSearchParams
            ? {}
            : body
              ? { "Content-Type": "application/json" }
              : {}),
        },
        body:
          body instanceof URLSearchParams
            ? body
            : body
              ? JSON.stringify(body)
              : undefined,
        redirect: "manual",
      });
      for (const value of response.headers.getSetCookie()) {
        const pair = value.split(";")[0],
          i = pair.indexOf("=");
        jar.set(pair.slice(0, i), pair.slice(i + 1));
      }
      return response;
    }
    try {
      assert.equal(
        (
          await request("/api/register", {
            email,
            password,
            name: "AI workflow fixture",
            workspace: "Temporary workflow workspace",
          })
        ).status,
        201,
      );
      const csrf = await (await request("/api/auth/csrf")).json();
      await request(
        "/api/auth/callback/credentials",
        new URLSearchParams({
          email,
          password,
          csrfToken: csrf.csrfToken,
          json: "true",
          callbackUrl: base + "/dashboard",
        }),
      );
      const user = await db.user.findUniqueOrThrow({
        where: { email },
        include: { memberships: true },
      });
      workspaceId = user.memberships[0].workspaceId;
      const product = await db.product.create({
        data: {
          workspaceId,
          name: "Original test title",
          description: "Original test description",
          price: "1.00",
        },
      });
      const title = await db.aIContentGeneration.create({
        data: {
          workspaceId,
          productId: product.id,
          generationType: "TITLE",
          prompt: "Approval test fixture",
          result: "Draft fixture title",
          model: "test-fixture",
          estimatedCost: "0",
        },
      });
      assert.equal(
        (
          await request("/api/ai/apply", {
            generationId: title.id,
            content: "Merchant edited title",
          })
        ).status,
        200,
      );
      assert.equal(
        (await db.product.findUniqueOrThrow({ where: { id: product.id } }))
          .name,
        "Merchant edited title",
      );
      const other = await db.user.create({
        data: { name: "Other workflow fixture", email: otherEmail },
      });
      const otherWorkspace = await db.workspace.create({
        data: {
          name: "Other isolated workflow",
          slug: `test-${randomUUID()}`,
          ownerId: other.id,
        },
      });
      otherWorkspaceId = otherWorkspace.id;
      const foreign = await db.aIContentGeneration.create({
        data: {
          workspaceId: otherWorkspace.id,
          generationType: "TITLE",
          prompt: "Cross-workspace test",
          result: "Other workspace fixture",
          model: "test-fixture",
          estimatedCost: "0",
        },
      });
      assert.equal(
        (await request("/api/ai/apply", { generationId: foreign.id })).status,
        404,
      );
      await db.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: user.id } },
        data: { role: "MEMBER" },
      });
      assert.equal(
        (
          await request("/api/ai/apply", {
            generationId: title.id,
            content: "Not permitted",
          })
        ).status,
        403,
      );
      assert.equal(
        (await db.product.findUniqueOrThrow({ where: { id: product.id } }))
          .name,
        "Merchant edited title",
      );
      await db.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: user.id } },
        data: { role: "OWNER" },
      });
      key = `workspaces/${workspaceId}/products/${product.id}/ai-drafts/${randomUUID()}.png`;
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
        "base64",
      );
      await r2.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          Body: png,
          ContentType: "image/png",
        }),
      );
      await r2.send(
        new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
      );
      const image = await db.aIContentGeneration.create({
        data: {
          workspaceId,
          productId: product.id,
          generationType: "IMAGE_GENERATION",
          prompt: "Explicit storage test fixture",
          result: JSON.stringify({
            storageKey: key,
            url: `${process.env.R2_PUBLIC_URL!.replace(/\/$/, "")}/${key}`,
          }),
          model: "test-fixture",
          estimatedCost: "0",
        },
      });
      assert.equal(
        (await request("/api/ai/apply", { generationId: image.id })).status,
        200,
      );
      assert.equal(
        (await request("/api/ai/apply", { generationId: image.id })).status,
        200,
      );
      assert.equal(
        await db.productImage.count({ where: { productId: product.id } }),
        1,
      );
      assert.equal((await request("/dashboard/ai-studio")).status, 200);
      console.log(
        "Approval, R2 object storage, image attachment, idempotency, and access controls verified with disposable fixtures",
      );
    } finally {
      if (key)
        await r2.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
          }),
        );
      if (workspaceId)
        await db.workspace.delete({ where: { id: workspaceId } });
      if (otherWorkspaceId)
        await db.workspace.delete({ where: { id: otherWorkspaceId } });
      await db.user.deleteMany({
        where: { email: { in: [email, otherEmail] } },
      });
      for (const identity of [`register:${email}`, `login:${email}`])
        await db.rateLimit.deleteMany({
          where: { key: createHash("sha256").update(identity).digest("hex") },
        });
      await db.$disconnect();
      r2.destroy();
      console.log(
        "Temporary workflow accounts, workspaces, and R2 object removed",
      );
    }
  },
);

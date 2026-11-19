import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  S3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresConnectionString } from "../src/lib/database-url";
import type { GenerationView } from "../src/lib/services/ai/types";

// Explicit opt-in: uses real OpenAI credits, Neon, and R2; removes only its own fixtures.
test(
  "live AI Studio: text, images, review/apply, usage, and tenant isolation",
  { skip: process.env.DUO_RUN_OPENAI_TESTS !== "1", timeout: 600000 },
  async () => {
    assert.ok(process.env.OPENAI_API_KEY && process.env.DATABASE_URL);
    const base = "http://localhost:3000";
    const db = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: postgresConnectionString(process.env.DATABASE_URL!),
        max: 2,
      }),
    });
    const email = `duo-ai-test-${randomUUID()}@example.invalid`,
      password = `${randomUUID()}${randomUUID()}`;
    const jar = new Map<string, string>();
    const assets = new Set<string>();
    let workspaceId: string | undefined;
    const r2 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    async function request(path: string, init: RequestInit = {}) {
      const response = await fetch(base + path, {
        ...init,
        redirect: "manual",
        headers: {
          Origin: base,
          Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
          ...init.headers,
        },
      });
      for (const item of response.headers.getSetCookie()) {
        const pair = item.split(";")[0],
          index = pair.indexOf("=");
        jar.set(pair.slice(0, index), pair.slice(index + 1));
      }
      return response;
    }
    async function post(path: string, body: unknown) {
      const response = await request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      assert.equal(
        response.status,
        200,
        JSON.stringify({
          path,
          status: response.status,
          error: data.error,
          code: data.code,
        }),
      );
      return data;
    }
    try {
      const signup = await request("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: "AI verification",
          workspace: "Temporary AI verification",
        }),
      });
      assert.equal(signup.status, 201);
      const csrf = await (await request("/api/auth/csrf")).json();
      await request("/api/auth/callback/credentials", {
        method: "POST",
        body: new URLSearchParams({
          email,
          password,
          csrfToken: csrf.csrfToken,
          json: "true",
          callbackUrl: base + "/dashboard",
        }),
      });
      const user = await db.user.findUniqueOrThrow({
        where: { email },
        include: { memberships: true },
      });
      workspaceId = user.memberships[0].workspaceId;
      const product = await db.product.create({
        data: {
          workspaceId,
          name: "White ceramic mug",
          description:
            "A white ceramic mug with one handle, 350 ml capacity. No other specifications are verified.",
          price: "29.99",
          currency: "SAR",
        },
      });
      const common = {
        productId: product.id,
        language: "ar",
        tone: "professional",
        keywords: "كوب، سيراميك",
        prompt: "اكتب بناءً على المعلومات المتاحة فقط.",
      };
      const generate = async (
        kind: string,
        extra: Record<string, unknown> = {},
      ) => {
        const input = { ...common, kind, requestId: randomUUID(), ...extra };
        const data = await post("/api/ai/generate", input);
        const result = data.generation as GenerationView;
        assert.ok(result.id && result.tokenUsage > 0);
        assert.ok(Number(result.estimatedCost) > 0);
        console.log(
          JSON.stringify({
            kind,
            model: result.model,
            tokens: result.tokenUsage,
            estimatedUSD: result.estimatedCost,
          }),
        );
        return { input, result };
      };
      const title = await generate("TITLE");
      assert.ok(/[\u0600-\u06ff]/.test(title.result.content));
      assert.equal(
        (await db.product.findUniqueOrThrow({ where: { id: product.id } }))
          .name,
        product.name,
        "Generation must not automatically change the product",
      );
      const duplicate = await post("/api/ai/generate", title.input);
      assert.equal(duplicate.generation.id, title.result.id);
      assert.equal(
        await db.aIContentGeneration.count({ where: { id: title.result.id } }),
        1,
      );
      const editedTitle = title.result.content.slice(0, 180);
      await post("/api/ai/apply", {
        generationId: title.result.id,
        content: editedTitle,
      });
      assert.equal(
        (await db.product.findUniqueOrThrow({ where: { id: product.id } }))
          .name,
        editedTitle,
      );
      const description = await generate("DESCRIPTION", {
        language: "en",
        prompt: "Write a concise description without inventing claims.",
      });
      await post("/api/ai/apply", {
        generationId: description.result.id,
        content: description.result.content,
      });
      assert.equal(
        (await db.product.findUniqueOrThrow({ where: { id: product.id } }))
          .description,
        description.result.content,
      );
      const seo = await generate("SEO");
      assert.ok(seo.result.content.length > 10);
      const blocked = await request("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...common,
          requestId: randomUUID(),
          kind: "TITLE",
          productId: "not-a-member-product",
        }),
      });
      assert.equal(blocked.status, 404);
      await db.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: user.id } },
        data: { role: "MEMBER" },
      });
      const member = await request("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...common,
          requestId: randomUUID(),
          kind: "TITLE",
        }),
      });
      assert.equal(member.status, 403);
      await db.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: user.id } },
        data: { role: "OWNER" },
      });
      const image = await generate("IMAGE_GENERATION", {
        prompt:
          "A studio photograph of a plain white ceramic mug with a single handle on a pale lavender background. No text or branding.",
      });
      assert.ok(image.result.imageUrl);
      const imageRecord = await db.aIContentGeneration.findUniqueOrThrow({
        where: { id: image.result.id },
      });
      const asset = JSON.parse(imageRecord.result) as { storageKey: string };
      assets.add(asset.storageKey);
      await r2.send(
        new HeadObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: asset.storageKey,
        }),
      );
      await post("/api/ai/apply", { generationId: image.result.id });
      await post("/api/ai/apply", { generationId: image.result.id });
      const source = await db.productImage.findFirstOrThrow({
        where: { productId: product.id },
      });
      assert.equal(
        await db.productImage.count({ where: { productId: product.id } }),
        1,
        "Image apply must be idempotent",
      );
      const edit = await generate("IMAGE_EDIT", {
        imageId: source.id,
        prompt:
          "Preserve the same plain white ceramic mug and handle. Change only the background to a soft blush pink, with realistic studio lighting.",
      });
      assert.ok(edit.result.imageUrl);
      const editedRecord = await db.aIContentGeneration.findUniqueOrThrow({
        where: { id: edit.result.id },
      });
      assets.add(
        (JSON.parse(editedRecord.result) as { storageKey: string }).storageKey,
      );
      assert.equal(
        await db.aIContentGeneration.count({ where: { workspaceId } }),
        5,
      );
      assert.equal((await request("/dashboard/ai-studio")).status, 200);
    } finally {
      if (workspaceId) {
        const records = await db.aIContentGeneration.findMany({
          where: {
            workspaceId,
            generationType: { in: ["IMAGE_GENERATION", "IMAGE_EDIT"] },
          },
        });
        for (const record of records) {
          try {
            const parsed = JSON.parse(record.result);
            if (
              typeof parsed.storageKey === "string" &&
              parsed.storageKey.startsWith(`workspaces/${workspaceId}/`)
            )
              assets.add(parsed.storageKey);
          } catch {}
        }
      }
      for (const key of assets)
        await r2.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
          }),
        );
      if (workspaceId) {
        await db.workspace.delete({ where: { id: workspaceId } });
        for (const identity of [`ai:${workspaceId}`, `ai-image:${workspaceId}`])
          await db.rateLimit.deleteMany({
            where: { key: createHash("sha256").update(identity).digest("hex") },
          });
      }
      await db.user.deleteMany({ where: { email } });
      for (const identity of [`register:${email}`, `login:${email}`])
        await db.rateLimit.deleteMany({
          where: { key: createHash("sha256").update(identity).digest("hex") },
        });
      await db.$disconnect();
      r2.destroy();
      console.log(
        "Temporary AI verification account, workspace, and R2 images removed",
      );
    }
  },
);

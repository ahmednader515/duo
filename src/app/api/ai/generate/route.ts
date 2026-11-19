import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, apiError } from "@/lib/http";
import { generationSchema, isImageGeneration } from "@/lib/validations/ai";
import { rateLimit } from "@/lib/rate-limit";
import { aiConfigured, aiService, AIProviderError } from "@/lib/services/ai";
import {
  storageConfigured,
  uploadImage,
  deleteImage,
  readImage,
} from "@/lib/services/storage/r2";
import { generationView } from "@/lib/services/ai/history";
import type { GenerationRequest } from "@/lib/services/ai/types";
import { readBoundedJson } from "@/lib/request-body";

export const maxDuration = 240;
export async function POST(request: Request) {
  let claimed: string | null = null;
  try {
    assertSameOrigin(request);
    if (!(await auth())?.user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { workspaceId, userId } = await requireWorkspace(true);
    if (!aiConfigured)
      throw new AIProviderError(
        "not_configured",
        "OpenAI is not configured on the server.",
        503,
      );
    if (Number(request.headers.get("content-length") || 0) > 32000)
      return NextResponse.json(
        { error: "Request is too large" },
        { status: 413 },
      );
    const parsed = generationSchema.safeParse(
      await readBoundedJson(request, 32000),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    const input = parsed.data;
    const product = await prisma.product.findFirst({
      where: { id: input.productId, workspaceId },
      include: { category: { select: { name: true } } },
    });
    if (!product)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    const image = isImageGeneration(input.kind);
    if (image && !storageConfigured)
      throw new AIProviderError(
        "storage",
        "Cloudflare R2 must be configured before generating images.",
        503,
      );
    const source =
      input.kind === "IMAGE_EDIT"
        ? await prisma.productImage.findFirst({
            where: {
              id: input.imageId,
              productId: product.id,
              product: { workspaceId },
            },
          })
        : null;
    if (input.kind === "IMAGE_EDIT" && !source)
      return NextResponse.json(
        { error: "Source image not found" },
        { status: 404 },
      );
    const existing = await prisma.aIContentGeneration.findFirst({
      where: { id: input.requestId, workspaceId },
    });
    if (
      existing &&
      (existing.productId !== product.id ||
        existing.generationType !== input.kind)
    )
      return NextResponse.json(
        {
          error:
            "This request identifier is already used for another generation.",
        },
        { status: 409 },
      );
    if (existing)
      return NextResponse.json({
        generation: generationView(existing, product.name),
      });
    const claim = createHash("sha256")
      .update(`ai-request:${workspaceId}:${input.requestId}`)
      .digest("hex");
    try {
      await prisma.rateLimit.create({
        data: { key: claim, resetAt: new Date(Date.now() + 86400000) },
      });
      claimed = claim;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        return NextResponse.json(
          {
            error:
              "This generation is already in progress. Check your history before trying again.",
          },
          { status: 409 },
        );
      throw error;
    }
    await rateLimit(`ai:${workspaceId}`, 20);
    if (image) await rateLimit(`ai-image:${workspaceId}`, 5);
    const context: GenerationRequest = {
      workspaceId,
      productId: product.id,
      product: {
        name: product.name,
        description: product.description.slice(0, 12000),
        category: product.category?.name || null,
        price: product.price.toString(),
        currency: product.currency,
        sku: product.sku,
      },
      language: input.language,
      tone: input.tone,
      prompt: input.prompt,
      keywords: input.keywords
        .split(/[,،\n]/)
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 30),
    };
    let stored: { key: string; url: string } | null = null;
    let result: string;
    let model: string;
    let inputTokens: number;
    let outputTokens: number;
    let estimatedCost: string;
    if (image) {
      const generated = source
        ? await aiService.editImage({
            ...context,
            image: await readImage(source.storageKey, workspaceId),
          })
        : await aiService.generateImage(context);
      const bytes = Buffer.from(generated.imageBase64, "base64");
      stored = await uploadImage(
        new File([new Uint8Array(bytes)], "generated.webp", {
          type: "image/webp",
        }),
        workspaceId,
        `products/${product.id}/ai-drafts`,
      );
      result = JSON.stringify({ url: stored.url, storageKey: stored.key });
      ({ model, inputTokens, outputTokens, estimatedCost } = generated);
    } else {
      const generated =
        input.kind === "TITLE"
          ? await aiService.generateTitle(context)
          : input.kind === "SEO"
            ? await aiService.generateSEO(context)
            : await aiService.generateDescription(context);
      result = generated.content;
      ({ model, inputTokens, outputTokens, estimatedCost } = generated);
    }
    try {
      const saved = await prisma.$transaction(async (tx) => {
        const generation = await tx.aIContentGeneration.create({
          data: {
            id: input.requestId,
            workspaceId,
            productId: product.id,
            generationType: input.kind,
            prompt: JSON.stringify({
              prompt: input.prompt,
              language: input.language,
              tone: input.tone,
              keywords: context.keywords,
            }),
            result,
            model,
            tokenUsage: inputTokens + outputTokens,
            estimatedCost,
          },
        });
        await tx.activityLog.create({
          data: {
            workspaceId,
            userId,
            action: "AI_CONTENT_GENERATED",
            metadata: {
              generationId: generation.id,
              productId: product.id,
              kind: input.kind,
            },
          },
        });
        return generation;
      });
      revalidatePath("/dashboard", "layout");
      return NextResponse.json({
        generation: generationView(saved, product.name),
      });
    } catch (error) {
      if (stored)
        await deleteImage(stored.key, workspaceId).catch(() =>
          console.error("AI upload cleanup requires retry"),
        );
      throw error;
    }
  } catch (error) {
    if (claimed)
      await prisma.rateLimit
        .deleteMany({ where: { key: claimed } })
        .catch(() => {});
    if (error instanceof AIProviderError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    return apiError(error);
  }
}

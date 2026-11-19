import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, apiError } from "@/lib/http";
import {
  applyGenerationSchema,
  imageResultSchema,
  isImageGeneration,
} from "@/lib/validations/ai";
import { readBoundedJson } from "@/lib/request-body";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!(await auth())?.user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { workspaceId, userId } = await requireWorkspace(true);
    if (Number(request.headers.get("content-length") || 0) > 90000)
      return NextResponse.json(
        { error: "Request is too large" },
        { status: 413 },
      );
    const input = applyGenerationSchema.safeParse(
      await readBoundedJson(request, 90000),
    );
    if (!input.success)
      return NextResponse.json(
        { error: input.error.issues[0].message },
        { status: 400 },
      );
    const generation = await prisma.aIContentGeneration.findFirst({
      where: { id: input.data.generationId, workspaceId },
    });
    if (!generation?.productId)
      return NextResponse.json(
        { error: "Generation or product not found" },
        { status: 404 },
      );
    if (generation.generationType === "SEO")
      return NextResponse.json(
        {
          error:
            "SEO keywords are saved in history. Copy them for your listing; they do not replace the product description.",
        },
        { status: 400 },
      );
    const content = (input.data.content ?? generation.result).trim();
    if (
      !isImageGeneration(generation.generationType) &&
      (!content ||
        content.length > (generation.generationType === "TITLE" ? 200 : 20000))
    )
      return NextResponse.json(
        { error: "Check the generated text length before saving." },
        { status: 400 },
      );
    const productId = generation.productId;
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "Product" WHERE "id"=${productId} AND "workspaceId"=${workspaceId} FOR UPDATE`;
      if (!locked.length) throw new Error("Product not authorized");
      if (isImageGeneration(generation.generationType)) {
        const asset = imageResultSchema.parse(JSON.parse(generation.result));
        if (
          !asset.storageKey.startsWith(
            `workspaces/${workspaceId}/products/${productId}/`,
          )
        )
          throw new Error("Image not authorized");
        const existing = await tx.productImage.findUnique({
          where: { storageKey: asset.storageKey },
        });
        if (!existing) {
          const count = await tx.productImage.count({
            where: { productId },
          });
          if (count >= 12)
            throw new Error(
              "Maximum 12 images per product. Remove an image before adding this one.",
            );
          const order = await tx.productImage.aggregate({
            where: { productId },
            _max: { sortOrder: true },
          });
          await tx.productImage.create({
            data: {
              productId,
              url: asset.url,
              storageKey: asset.storageKey,
              isPrimary: count === 0,
              sortOrder: (order._max.sortOrder ?? -1) + 1,
            },
          });
        }
      } else {
        await tx.product.update({
          where: { id: productId, workspaceId },
          data:
            generation.generationType === "TITLE"
              ? { name: content }
              : { description: content },
        });
      }
      await tx.activityLog.create({
        data: {
          workspaceId,
          userId,
          action: "AI_CONTENT_APPLIED",
          metadata: {
            generationId: generation.id,
            productId,
            kind: generation.generationType,
          },
        },
      });
    });
    revalidatePath("/dashboard", "layout");
    return NextResponse.json({
      success: true,
      productId,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Maximum 12"))
      return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error);
  }
}

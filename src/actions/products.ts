"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/workspace";
import { productSchema } from "@/lib/validations";
import { deleteImage } from "@/lib/services/storage/r2";
import { Prisma } from "@/generated/prisma/client";
import { imageResultSchema } from "@/lib/validations/ai";
export type ActionResult = { error?: string; id?: string; success?: boolean };
export async function saveProduct(
  id: string | null,
  form: FormData,
): Promise<ActionResult> {
  const { workspaceId, userId } = await requireWorkspace(true);
  const parsed = productSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(" · "),
    };
  const { categoryId, length, width, height, ...fields } = parsed.data;
  try {
    const product = await prisma.$transaction(async (tx) => {
      if (
        categoryId &&
        !(await tx.category.findFirst({
          where: { id: categoryId, workspaceId },
        }))
      )
        throw new Error("Invalid category");
      const data = {
        ...fields,
        categoryId,
        dimensions: { length, width, height },
      };
      if (id && !(await tx.product.findFirst({ where: { id, workspaceId } })))
        throw new Error("Product not found");
      const saved = id
        ? await tx.product.update({ where: { id, workspaceId }, data })
        : await tx.product.create({ data: { ...data, workspaceId } });
      await tx.activityLog.create({
        data: {
          workspaceId,
          userId,
          action: id ? "PRODUCT_UPDATED" : "PRODUCT_CREATED",
          metadata: { productId: saved.id, name: saved.name },
        },
      });
      return saved;
    });
    revalidatePath("/dashboard", "layout");
    return { id: product.id, success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { error: "This SKU is already used in your workspace." };
    return {
      error: "Unable to save this product. Check your details and try again.",
    };
  }
}
export async function removeProduct(id: string): Promise<ActionResult> {
  const { workspaceId, userId } = await requireWorkspace(true);
  const product = await prisma.product.findFirst({
    where: { id, workspaceId },
    include: { images: true },
  });
  if (!product) return { error: "Product not found." };
  try {
    // Keep DB records on storage failure so deletion is safe to retry. R2 delete is idempotent.
    const imageKeys = new Set(product.images.map((image) => image.storageKey));
    const drafts = await prisma.aIContentGeneration.findMany({
      where: {
        workspaceId,
        productId: id,
        generationType: { in: ["IMAGE_GENERATION", "IMAGE_EDIT"] },
      },
      select: { result: true },
    });
    for (const draft of drafts) {
      try {
        const asset = imageResultSchema.safeParse(JSON.parse(draft.result));
        if (
          asset.success &&
          asset.data.storageKey.startsWith(
            `workspaces/${workspaceId}/products/${id}/`,
          )
        )
          imageKeys.add(asset.data.storageKey);
      } catch {
        /* Non-image legacy results have no storage asset. */
      }
    }
    for (const key of imageKeys) await deleteImage(key, workspaceId);
    await prisma.$transaction(async (tx) => {
      await tx.aIContentGeneration.updateMany({
        where: { productId: id, workspaceId },
        data: { productId: null },
      });
      await tx.product.delete({ where: { id, workspaceId } });
      await tx.activityLog.create({
        data: {
          workspaceId,
          userId,
          action: "PRODUCT_DELETED",
          metadata: { name: product.name },
        },
      });
    });
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch {
    return {
      error:
        "Deletion did not finish. Please retry; your product record has been preserved.",
    };
  }
}
export async function createCategory(name: string): Promise<ActionResult> {
  const { workspaceId } = await requireWorkspace(true);
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 100)
    return { error: "Category name must be 2–100 characters." };
  try {
    const category = await prisma.category.create({
      data: {
        workspaceId,
        name: trimmed,
        slug: `${trimmed.toLowerCase().replace(/\s+/g, "-")}-${crypto.randomUUID().slice(0, 8)}`,
      },
    });
    revalidatePath("/dashboard/products", "layout");
    return { id: category.id, success: true };
  } catch {
    return { error: "Could not create category." };
  }
}

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, apiError, readUploadForm } from "@/lib/http";
import { uploadImage, deleteImage } from "@/lib/services/storage/r2";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!(await auth())?.user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { workspaceId, userId } = await requireWorkspace(true);
    await rateLimit(`upload:${userId}`, 60);
    if (Number(request.headers.get("content-length") || 0) > 6 * 1024 * 1024)
      return NextResponse.json(
        { error: "Maximum upload size is 5 MB" },
        { status: 413 },
      );
    const data = await readUploadForm(request);
    const file = data.get("file");
    const productId = data.get("productId");
    const logo = data.get("kind") === "logo";
    if (!(file instanceof File))
      return NextResponse.json({ error: "Select an image" }, { status: 400 });
    if (
      !logo &&
      (typeof productId !== "string" ||
        !(await prisma.product.findFirst({
          where: { id: productId, workspaceId },
        })))
    )
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (
      !logo &&
      (await prisma.productImage.count({
        where: { productId: String(productId) },
      })) >= 12
    )
      return NextResponse.json(
        { error: "Maximum 12 images per product" },
        { status: 400 },
      );
    const uploaded = await uploadImage(
      file,
      workspaceId,
      logo ? "logo" : `products/${productId}`,
    );
    try {
      if (logo) {
        const old = await prisma.workspace.findUniqueOrThrow({
          where: { id: workspaceId },
        });
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { logo: uploaded.url, logoKey: uploaded.key },
        });
        // Old object cleanup failure does not undo the successfully persisted new logo.
        if (old.logoKey)
          await deleteImage(old.logoKey, workspaceId).catch(() =>
            console.error("Old workspace logo cleanup needs retry"),
          );
      } else {
        await prisma.$transaction(async (tx) => {
          // Serialize image additions for this product, enforcing the cap under concurrency.
          const locked = await tx.$queryRaw<
            { id: string }[]
          >`SELECT "id" FROM "Product" WHERE "id" = ${String(productId)} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
          if (!locked.length) throw new Error("Product not found");
          const count = await tx.productImage.count({
            where: { productId: String(productId) },
          });
          if (count >= 12) throw new Error("Maximum 12 images per product");
          const latest = await tx.productImage.aggregate({
            where: { productId: String(productId) },
            _max: { sortOrder: true },
          });
          await tx.productImage.create({
            data: {
              productId: String(productId),
              url: uploaded.url,
              storageKey: uploaded.key,
              sortOrder: (latest._max.sortOrder ?? -1) + 1,
              isPrimary: count === 0,
            },
          });
        });
      }
    } catch (error) {
      await deleteImage(uploaded.key, workspaceId).catch(() =>
        console.error("Orphan upload cleanup needs retry"),
      );
      throw error;
    }
    revalidatePath("/dashboard", "layout");
    return NextResponse.json({ url: uploaded.url });
  } catch (error) {
    if (error instanceof Error && /valid JPEG|Images must/.test(error.message))
      return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    if (!(await auth())?.user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { workspaceId } = await requireWorkspace(true);
    const { id } = (await request.json()) as { id?: string };
    if (!id)
      return NextResponse.json({ error: "Image id required" }, { status: 400 });
    const image = await prisma.productImage.findFirst({
      where: { id, product: { workspaceId } },
    });
    if (!image)
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    await deleteImage(image.storageKey, workspaceId);
    await prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: image.id } });
      if (image.isPrimary) {
        const next = await tx.productImage.findFirst({
          where: { productId: image.productId },
          orderBy: { sortOrder: "asc" },
        });
        if (next)
          await tx.productImage.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
      }
    });
    revalidatePath("/dashboard", "layout");
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

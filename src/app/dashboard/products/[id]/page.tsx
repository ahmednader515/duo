import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { translate } from "@/lib/i18n";
import { Card } from "@/components/ui";
import { DeleteProduct } from "@/components/products/delete-product";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ upload?: string }>;
}) {
  const { workspaceId, role } = await requireWorkspace();
  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, workspaceId },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      category: true,
    },
  });
  if (!product) notFound();
  const ar = (await cookies()).get("duo-language")?.value !== "en";
  const t = translate(ar ? "ar" : "en");
  const dimensions = product.dimensions as {
    length?: number;
    width?: number;
    height?: number;
  } | null;
  return (
    <>
      {(await searchParams).upload === "failed" && (
        <div className="notice">
          {ar
            ? "حُفظ المنتج، لكن بعض الصور لم تُرفع. افتح التعديل لإعادة المحاولة."
            : "Your product was saved, but some images failed to upload. Open the editor to retry."}
        </div>
      )}
      <div className="page-title-row">
        <div>
            <h2>{product.name}</h2>
            <p className="form-help">SKU: {product.sku || "—"}</p>
          </div>
          {role !== "MEMBER" && (
            <div className="table-actions">
              <Link
                className="btn btn-primary"
                href={`/dashboard/products/${id}/edit`}
              >
                <Pencil size={15} />
                {t.edit}
              </Link>
              <DeleteProduct id={id} name={product.name} />
            </div>
          )}
        </div>
        <div>
        <Card className="form-section">
          <h2>{ar ? "تفاصيل المنتج" : "Product details"}</h2>
          <p className="detail-description">
            {product.description ||
              (ar ? "لم يُضف وصف بعد." : "No description added yet.")}
          </p>
          <dl className="detail-grid">
            {[
              [t.price, `${product.price} ${product.currency}`],
              [
                ar ? "السعر قبل الخصم" : "Compare-at price",
                product.compareAtPrice
                  ? `${product.compareAtPrice} ${product.currency}`
                  : "—",
              ],
              [t.stock, product.stock],
              [t.category, product.category?.name || "—"],
              [ar ? "الباركود" : "Barcode", product.barcode || "—"],
              [
                ar ? "الوزن" : "Weight",
                product.weight ? `${product.weight} kg` : "—",
              ],
              [
                ar ? "الأبعاد (سم)" : "Dimensions (cm)",
                dimensions
                  ? `${dimensions.length || 0} × ${dimensions.width || 0} × ${dimensions.height || 0}`
                  : "—",
              ],
              [
                t.status,
                product.status === "ACTIVE"
                  ? t.active
                  : product.status === "DRAFT"
                    ? t.draft
                    : t.archived,
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <h2>{ar ? "صور المنتج" : "Product images"}</h2>
          {product.images.length ? (
            <div className="image-grid">
              {product.images.map((im) => (
                <div className="image-tile" key={im.id}>
                  <Image
                    fill
                    unoptimized
                    src={im.url}
                    alt={product.name}
                    sizes="(max-width:760px) 40vw, 260px"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              {ar ? "لم تُضف صور بعد." : "No images added yet."}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

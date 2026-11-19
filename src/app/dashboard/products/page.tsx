import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { Plus, Package, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/workspace";
import { sortOptions } from "@/lib/data";
import { translate } from "@/lib/i18n";
import { Card, EmptyState } from "@/components/ui";
import { DeleteProduct } from "@/components/products/delete-product";
import type { Prisma } from "@/generated/prisma/client";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceId, role } = await requireWorkspace();
  const params = await searchParams;
  const value = (k: string) =>
    typeof params[k] === "string" ? (params[k] as string) : "";
  const q = value("q").slice(0, 200);
  const category = value("category");
  const status = value("status");
  const sort = value("sort");
  const requestedPage = Math.max(
    1,
    Math.min(1000000, Number.parseInt(value("page")) || 1),
  );
  const ar = (await cookies()).get("duo-language")?.value !== "en";
  const t = translate(ar ? "ar" : "en");
  const where: Prisma.ProductWhereInput = {
    workspaceId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)
      ? { status: status as "DRAFT" | "ACTIVE" | "ARCHIVED" }
      : {}),
    ...(category ? { categoryId: category } : {}),
  };
  const [count, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(count / 12));
  const page = Math.min(requestedPage, pages);
  const products = await prisma.product.findMany({
    where,
    orderBy:
      sortOptions[sort as keyof typeof sortOptions] || sortOptions.newest,
    skip: (page - 1) * 12,
    take: 12,
    include: {
      category: true,
      images: { take: 1, orderBy: { sortOrder: "asc" } },
    },
  });
  function url(p: number) {
    const next = new URLSearchParams({
      q,
      category,
      status,
      sort,
      page: String(p),
    });
    return `/dashboard/products?${next}`;
  }
  return (
    <>
      <div className="page-title-row">
        <div>
          <h2>
            {t.allProducts} <span className="badge">{count}</span>
          </h2>
          <p className="form-help">
            {ar
              ? "كل منتجاتك، بكل تفاصيلها."
              : "Your whole catalog, down to the details."}
          </p>
        </div>
        {role !== "MEMBER" && (
          <Link className="btn btn-primary" href="/dashboard/products/new">
            <Plus size={16} />
            {t.addProduct}
          </Link>
        )}
      </div>
      <Card>
        <form className="filter-bar">
          <input
            name="q"
            defaultValue={q}
            placeholder={t.search}
            aria-label={t.search}
          />
          <select
            name="category"
            defaultValue={category}
            aria-label={t.category}
          >
            <option value="">{ar ? "كل التصنيفات" : "All categories"}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status} aria-label={t.status}>
            <option value="">{ar ? "كل الحالات" : "All statuses"}</option>
            <option value="ACTIVE">{t.active}</option>
            <option value="DRAFT">{t.draft}</option>
            <option value="ARCHIVED">{t.archived}</option>
          </select>
          <select
            name="sort"
            defaultValue={sort}
            aria-label={ar ? "الترتيب" : "Sort"}
          >
            <option value="newest">
              {ar ? "الأحدث أولاً" : "Newest first"}
            </option>
            <option value="oldest">
              {ar ? "الأقدم أولاً" : "Oldest first"}
            </option>
            <option value="name">{ar ? "الاسم" : "Name"}</option>
            <option value="price_asc">
              {ar ? "السعر: الأقل" : "Price: low to high"}
            </option>
            <option value="price_desc">
              {ar ? "السعر: الأعلى" : "Price: high to low"}
            </option>
          </select>
          <button className="btn" type="submit">
            {ar ? "تطبيق" : "Apply"}
          </button>
        </form>
        {products.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      t.name,
                      "SKU",
                      t.category,
                      t.price,
                      t.stock,
                      t.status,
                      "",
                    ].map((v, i) => (
                      <th key={i}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link
                          href={`/dashboard/products/${p.id}`}
                          className="product-cell"
                        >
                          <span className="product-thumb">
                            {p.images[0] ? (
                              <Image
                                fill
                                src={p.images[0].url}
                                unoptimized
                                alt=""
                                sizes="43px"
                              />
                            ) : (
                              <Package size={20} />
                            )}
                          </span>
                          {p.name}
                        </Link>
                      </td>
                      <td>{p.sku || "—"}</td>
                      <td>{p.category?.name || "—"}</td>
                      <td>
                        {p.price.toString()} {p.currency}
                      </td>
                      <td>{p.stock}</td>
                      <td>
                        <span
                          className={`badge ${p.status === "ACTIVE" ? "badge-green" : p.status === "DRAFT" ? "badge-amber" : ""}`}
                        >
                          {p.status === "ACTIVE"
                            ? t.active
                            : p.status === "DRAFT"
                              ? t.draft
                              : t.archived}
                        </span>
                      </td>
                      <td>
                        {role !== "MEMBER" && (
                          <div className="table-actions">
                            <Link
                              className="icon-button"
                              href={`/dashboard/products/${p.id}/edit`}
                              aria-label={t.edit}
                            >
                              <Pencil size={15} />
                            </Link>
                            <DeleteProduct id={p.id} name={p.name} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {ar ? `صفحة ${page} من ${pages}` : `Page ${page} of ${pages}`}
              </span>
              <div className="table-actions">
                {page > 1 && (
                  <Link className="btn btn-sm" href={url(page - 1)}>
                    {ar ? "السابق" : "Previous"}
                  </Link>
                )}
                {page < pages && (
                  <Link className="btn btn-sm" href={url(page + 1)}>
                    {ar ? "التالي" : "Next"}
                  </Link>
                )}
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title={
              q || category || status
                ? ar
                  ? "لم نجد منتجات مطابقة"
                  : "No matching products"
                : t.noProducts
            }
            description={t.noProductsDescription}
            action={
              role !== "MEMBER" ? (
                <Link
                  className="btn btn-primary"
                  href="/dashboard/products/new"
                >
                  {t.addProduct}
                </Link>
              ) : undefined
            }
          />
        )}
      </Card>
    </>
  );
}

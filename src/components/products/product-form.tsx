"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Plus, UploadCloud, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { saveProduct, createCategory } from "@/actions/products";
import { Card } from "@/components/ui";
import {
  ImageUploader,
  sendImage,
  type ImageItem,
} from "@/components/products/image-uploader";
import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/providers";
export type ProductFormValue = {
  id: string;
  name: string;
  description: string;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  price: string;
  compareAtPrice: string | null;
  stock: number;
  weight: string | null;
  currency: string;
  status: string;
  dimensions: { length?: number; width?: number; height?: number } | null;
  images: ImageItem[];
};
export function ProductForm({
  product,
  categories,
  storage,
}: {
  product?: ProductFormValue;
  categories: { id: string; name: string }[];
  storage: boolean;
}) {
  const language = useLanguage();
  const ar = language === "ar";
  const t = translate(language);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [adding, setAdding] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await saveProduct(product?.id || null, form);
      if (result.error || !result.id)
        throw new Error(result.error || "Save failed");
      let failed = false;
      for (const file of files) {
        try {
          await sendImage(file, result.id);
        } catch (e) {
          failed = true;
          toast.error(e instanceof Error ? e.message : "Image upload failed");
        }
      }
      toast.success(ar ? "تم حفظ المنتج" : "Product saved");
      router.push(
        `/dashboard/products/${result.id}${failed ? "?upload=failed" : ""}`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  async function addCategory() {
    setCategoryBusy(true);
    try {
      const result = await createCategory(categoryName);
      if (result.error) throw new Error(result.error);
      setAdding(false);
      setCategoryName("");
      router.refresh();
      toast.success(ar ? "تمت إضافة التصنيف" : "Category created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Category failed");
    } finally {
      setCategoryBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="page-title-row">
        <div>
          <h2>{product ? t.edit : t.addProduct}</h2>
          <p className="form-help">
            {ar
              ? "كل التفاصيل المهمة، جاهزة لخطوتك القادمة."
              : "Every important detail, ready for your next step."}
          </p>
        </div>
        <Link className="btn" href="/dashboard/products">
          {t.cancel}
        </Link>
      </div>
      <div className="form-layout">
        <div>
          <Card className="form-section">
            <h2>{ar ? "معلومات المنتج" : "Product information"}</h2>
            <div className="form-grid">
              <label className="field-full">
                {t.name}
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={200}
                  defaultValue={product?.name}
                  placeholder={
                    ar ? "مثال: حقيبة سفر جلدية" : "e.g. Leather weekend bag"
                  }
                />
              </label>
              <label className="field-full">
                {ar ? "وصف المنتج" : "Description"}
                <textarea
                  name="description"
                  maxLength={20000}
                  defaultValue={product?.description}
                  placeholder={
                    ar
                      ? "احكِ قصة منتجك. ما الذي يجعله مميزاً؟"
                      : "Tell your product's story. What makes it special?"
                  }
                />
              </label>
              <label>
                SKU
                <input
                  name="sku"
                  maxLength={100}
                  defaultValue={product?.sku || ""}
                />
              </label>
              <label>
                {ar ? "الباركود" : "Barcode"}
                <input
                  name="barcode"
                  maxLength={100}
                  defaultValue={product?.barcode || ""}
                />
              </label>
              <label className="field-full">
                {t.category}
                <select
                  name="categoryId"
                  defaultValue={product?.categoryId || ""}
                >
                  <option value="">
                    {ar ? "بدون تصنيف" : "Uncategorized"}
                  </option>
                  {categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              style={{ marginTop: 14 }}
              onClick={() => setAdding(!adding)}
            >
              <Plus size={13} />
              {ar ? "تصنيف جديد" : "New category"}
            </button>
            {adding && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input
                  aria-label="Category name"
                  placeholder={ar ? "اسم التصنيف" : "Category name"}
                  maxLength={100}
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                />
                <button
                  disabled={categoryBusy}
                  type="button"
                  className="btn btn-sm"
                  onClick={addCategory}
                >
                  {ar ? "إضافة" : "Add"}
                </button>
              </div>
            )}
          </Card>
          <Card className="form-section">
            <h2>{ar ? "السعر والمخزون" : "Pricing & inventory"}</h2>
            <div className="form-grid">
              <label>
                {t.price}
                <input
                  name="price"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  max="999999999999.99"
                  defaultValue={product?.price || "0"}
                />
              </label>
              <label>
                {ar ? "السعر قبل الخصم" : "Compare-at price"}
                <input
                  name="compareAtPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={product?.compareAtPrice || ""}
                />
              </label>
              <label>
                {ar ? "العملة" : "Currency"}
                <select
                  name="currency"
                  defaultValue={product?.currency || "SAR"}
                >
                  {["SAR", "USD", "AED", "EUR"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                {t.stock}
                <input
                  name="stock"
                  type="number"
                  required
                  min="0"
                  step="1"
                  defaultValue={product?.stock || 0}
                />
              </label>
            </div>
          </Card>
          <Card className="form-section">
            <h2>{ar ? "الشحن والأبعاد" : "Shipping & dimensions"}</h2>
            <div className="form-grid">
              <label>
                {ar ? "الوزن (كجم)" : "Weight (kg)"}
                <input
                  name="weight"
                  type="number"
                  min="0"
                  step="0.001"
                  defaultValue={product?.weight || ""}
                />
              </label>
              {(["length", "width", "height"] as const).map((key, i) => (
                <label key={key}>
                  {ar
                    ? ["الطول (سم)", "العرض (سم)", "الارتفاع (سم)"][i]
                    : `${key.charAt(0).toUpperCase() + key.slice(1)} (cm)`}
                  <input
                    name={key}
                    type="number"
                    min="0"
                    max="100000"
                    step="0.01"
                    defaultValue={product?.dimensions?.[key] || 0}
                  />
                </label>
              ))}
            </div>
          </Card>
          <Card className="form-section">
            <h2>{ar ? "صور المنتج" : "Product images"}</h2>
            {product ? (
              <ImageUploader
                productId={product.id}
                images={product.images}
                configured={storage}
              />
            ) : (
              <>
                <label className="upload-zone">
                  <UploadCloud size={28} />
                  <span>
                    {ar ? "اختر صور منتجك" : "Choose your product images"}
                  </span>
                  <small>JPEG, PNG, WebP · 5 MB / image</small>
                  <input
                    disabled={!storage}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files || []);
                      if (
                        picked.length > 12 ||
                        picked.some((f) => f.size > 5 * 1024 * 1024)
                      ) {
                        toast.error("Choose up to 12 images, each under 5 MB.");
                        e.target.value = "";
                        setFiles([]);
                        return;
                      }
                      setFiles(picked);
                    }}
                  />
                </label>
                {files.map((f, i) => (
                  <p className="form-help" key={`${f.name}-${i}`}>
                    {f.name}
                  </p>
                ))}
                <p className="form-help">
                  {storage
                    ? ar
                      ? "تُرفع الصور بعد حفظ المنتج. إذا تعذر الرفع سيظل المنتج محفوظاً."
                      : "Images upload after the product is saved. A failed upload will preserve your product."
                    : ar
                      ? "رفع الصور غير متاح حتى إعداد Cloudflare R2."
                      : "Image uploads are unavailable until Cloudflare R2 is configured."}
                </p>
              </>
            )}
          </Card>
        </div>
        <aside>
          <Card className="form-section">
            <h2>{ar ? "حالة المنتج" : "Product status"}</h2>
            <label>
              {t.status}
              <select name="status" defaultValue={product?.status || "DRAFT"}>
                <option value="DRAFT">{t.draft}</option>
                <option value="ACTIVE">{t.active}</option>
                <option value="ARCHIVED">{t.archived}</option>
              </select>
            </label>
            <p className="form-help">
              {ar
                ? "استخدم الحالة لتنظيم المنتجات النشطة والمسودات والمؤرشفة."
                : "Use status to organize active products, drafts, and archived items."}
            </p>
          </Card>
          <Card>
            <div className="card-title">
              <h2>
                <Sparkles
                  size={16}
                  style={{ display: "inline", marginInlineEnd: 7 }}
                />
                {ar ? "مساعدة Duo" : "A little help from Duo"}
              </h2>
            </div>
            <p className="form-help">
              {ar
                ? product
                  ? "افتح الاستوديو لتوليد المحتوى والصور ومراجعتها قبل الحفظ."
                  : "احفظ المنتج أولاً لاستخدام أدوات الذكاء الاصطناعي."
                : product
                  ? "Open AI Studio to generate and review content and images."
                  : "Save this product first to use AI Studio."}
            </p>
            {(ar
              ? [
                  "توليد عنوان بالذكاء الاصطناعي",
                  "توليد وصف المنتج",
                  "تحسين SEO",
                  "تحسين صورة المنتج",
                ]
              : [
                  "Generate product title",
                  "Generate description",
                  "Optimize SEO",
                  "Enhance product image",
                ]
            ).map((v, index) =>
              product ? (
                <Link
                  className="ai-action"
                  key={v}
                  href={`/dashboard/ai-studio?product=${product.id}&kind=${["TITLE", "DESCRIPTION", "SEO", "IMAGE_EDIT"][index]}`}
                >
                  <span>{v}</span>
                  <Sparkles size={13} />
                </Link>
              ) : (
                <button type="button" disabled className="ai-action" key={v}>
                  <span>{v}</span>
                  <Sparkles size={13} />
                </button>
              ),
            )}
          </Card>
        </aside>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="form-footer">
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy && <LoaderCircle size={15} className="animate-spin" />}
          {t.save}
        </button>
        <Link href="/dashboard/products" className="btn">
          {t.cancel}
        </Link>
      </div>
    </form>
  );
}

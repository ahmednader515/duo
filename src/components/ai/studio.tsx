"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ImagePlus,
  LoaderCircle,
  Copy,
  Check,
  ArrowUpRight,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/providers";
import { Card, EmptyState } from "@/components/ui";
import { isImageGeneration } from "@/lib/validations/ai";
import type { GenerationView } from "@/lib/services/ai/types";

type ProductOption = {
  id: string;
  name: string;
  images: { id: string; url: string }[];
};
type Props = {
  products: ProductOption[];
  history: GenerationView[];
  configured: boolean;
  storage: boolean;
  canWrite: boolean;
  initialProduct?: string;
  initialKind?: string;
};

export function Studio({
  products,
  history,
  configured,
  storage,
  canWrite,
  initialProduct,
  initialKind,
}: Props) {
  const ar = useLanguage() === "ar";
  const router = useRouter();
  const [selected, setSelected] = useState(
    products.some((p) => p.id === initialProduct) ? initialProduct! : "",
  );
  const [kind, setKind] = useState(
    ["TITLE", "DESCRIPTION", "SEO"].includes(initialKind || "")
      ? initialKind!
      : "DESCRIPTION",
  );
  const [language, setLanguage] = useState<"ar" | "en">(ar ? "ar" : "en");
  const [tone, setTone] = useState("professional");
  const [keywords, setKeywords] = useState("");
  const [prompt, setPrompt] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageMode, setImageMode] = useState(
    initialKind === "IMAGE_EDIT" ? "IMAGE_EDIT" : "IMAGE_GENERATION",
  );
  const [imageId, setImageId] = useState("");
  const [busy, setBusy] = useState<"text" | "image" | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [textResult, setTextResult] = useState<GenerationView | null>(null);
  const [imageResult, setImageResult] = useState<GenerationView | null>(null);
  const [review, setReview] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [recent, setRecent] = useState<GenerationView[]>([]);
  const lock = useRef(false);
  const product = products.find((p) => p.id === selected);
  const label = (type: string) =>
    ({
      TITLE: ar ? "عنوان المنتج" : "Product title",
      DESCRIPTION: ar ? "وصف المنتج" : "Product description",
      SEO: ar ? "كلمات SEO" : "SEO keywords",
      IMAGE_GENERATION: ar ? "توليد صورة" : "Image generation",
      IMAGE_EDIT: ar ? "تعديل صورة" : "Image edit",
    })[type] || type;
  const items = [
    ...new Map([...recent, ...history].map((item) => [item.id, item])).values(),
  ];
  const enabled = configured && canWrite && Boolean(product);
  function apiMessage(data: { error?: string; code?: string }) {
    if (ar) {
      const translated: Record<string, string> = {
        billing:
          "رصيد مشروع OpenAI غير متاح. تحقق من الفوترة وحدود الاستخدام في حسابك.",
        invalid_key:
          "مفتاح OpenAI غير صالح أو انتهت صلاحيته. حدّث إعدادات الخادم.",
        model_access:
          "المشروع لا يملك صلاحية استخدام هذا النموذج. تحقق من صلاحيات النماذج وتوثيق المؤسسة.",
        rate_limit: "طلبات كثيرة إلى OpenAI. حاول بعد قليل.",
        timeout: "تعذر الوصول إلى OpenAI أو انتهت مهلة الطلب. حاول مرة أخرى.",
        content_policy: "تعذر تنفيذ هذا الطلب. عدّل الوصف وحاول مرة أخرى.",
        provider_error: "تعذر إكمال التوليد لدى OpenAI. حاول مرة أخرى.",
        invalid_output:
          "لم يعد النموذج بنتيجة مكتملة. عدّل طلبك وحاول مرة أخرى.",
      };
      if (data.code && translated[data.code]) return translated[data.code];
    }
    return (
      data.error ||
      (ar ? "تعذر إكمال الطلب." : "Could not complete the request.")
    );
  }
  async function generate(image: boolean) {
    if (lock.current || !enabled) return;
    lock.current = true;
    setBusy(image ? "image" : "text");
    setError("");
    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          productId: selected,
          kind: image ? imageMode : kind,
          language,
          tone,
          keywords,
          prompt: image ? imagePrompt : prompt,
          ...(image && imageMode === "IMAGE_EDIT" ? { imageId } : {}),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        code?: string;
        generation?: GenerationView;
      };
      if (!response.ok || !data.generation) throw new Error(apiMessage(data));
      const result = data.generation;
      setRecent((previous) => [result, ...previous]);
      if (image) setImageResult(result);
      else {
        setTextResult(result);
        setReview(result.content);
      }
      toast.success(ar ? "النتيجة جاهزة للمراجعة" : "Ready for your review");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : ar
            ? "تعذر التوليد"
            : "Generation failed",
      );
    } finally {
      setBusy(null);
      lock.current = false;
    }
  }
  async function apply(result: GenerationView) {
    if (lock.current) return;
    lock.current = true;
    setApplying(result.id);
    setError("");
    try {
      const response = await fetch("/api/ai/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId: result.id,
          ...(!isImageGeneration(result.kind) ? { content: review } : {}),
        }),
      });
      const data = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) throw new Error(apiMessage(data));
      setSaved((previous) => [...previous, result.id]);
      toast.success(ar ? "تم حفظ النتيجة في المنتج" : "Saved to your product");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setApplying(null);
      lock.current = false;
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(review);
      toast.success(ar ? "تم النسخ" : "Copied");
    } catch {
      toast.error(
        ar ? "حدد النص وانسخه يدوياً" : "Select and copy the text manually",
      );
    }
  }
  function selectProduct(id: string) {
    setSelected(id);
    setImageId("");
    setTextResult(null);
    setImageResult(null);
    setReview("");
    setError("");
  }
  const pending = busy !== null || applying !== null;
  return (
    <>
      {!configured && (
        <div className="notice">
          {ar
            ? "أضف OPENAI_API_KEY في إعدادات الخادم لتفعيل الذكاء الاصطناعي."
            : "Add OPENAI_API_KEY to the server environment to enable AI Studio."}
        </div>
      )}
      {!canWrite && (
        <div className="notice">
          {ar
            ? "التوليد وحفظ المحتوى متاحان للمالك والمسؤول فقط."
            : "Only workspace owners and admins can generate and apply content."}
        </div>
      )}
      {configured && canWrite && (
        <div className="ai-intro">
          <span className="badge badge-green">
            <Sparkles size={12} />
            {ar ? "مدعوم بـ OpenAI" : "Powered by OpenAI"}
          </span>
          <p>
            {ar
              ? "جهّز المحتوى والصور، راجع النتيجة، ثم احفظ ما يعجبك. يتم احتساب التوليد على حساب OpenAI المتصل."
              : "Generate content and images, review the result, then save what works. Generations use your connected OpenAI account."}
          </p>
        </div>
      )}
      {products.length === 0 && (
        <Card className="form-section">
          <EmptyState
            title={
              ar
                ? "أضف منتجك الأول لنبدأ"
                : "Add your first product to get started"
            }
            description={
              ar
                ? "Duo يستخدم تفاصيل منتجك لكتابة محتوى مناسب وإنشاء صور تعبّر عنه."
                : "Duo uses product details to create relevant copy and images."
            }
            action={
              <Link className="btn btn-primary" href="/dashboard/products/new">
                {ar ? "أضف منتجاً" : "Add product"}
              </Link>
            }
          />
        </Card>
      )}
      {error && (
        <div
          role="alert"
          className="error-message"
          style={{ marginBottom: 20 }}
        >
          {error}
        </div>
      )}
      <div className="form-layout">
        <div>
          <Card className="form-section">
            <div className="card-title">
              <h2>
                <Sparkles
                  size={17}
                  style={{ display: "inline", marginInlineEnd: 8 }}
                />
                {ar
                  ? "من فكرة إلى محتوى يعبّر عنك"
                  : "From a thought to the right words"}
              </h2>
            </div>
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                void generate(false);
              }}
            >
              <label>
                {ar ? "اختر المنتج" : "Select a product"}
                <select
                  required
                  disabled={pending}
                  value={selected}
                  onChange={(e) => selectProduct(e.target.value)}
                >
                  <option value="">
                    {ar ? "اختر من منتجاتك" : "Choose from your products"}
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {ar ? "نوع المحتوى" : "Content type"}
                <select
                  disabled={pending}
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  {["TITLE", "DESCRIPTION", "SEO"].map((type) => (
                    <option key={type} value={type}>
                      {label(type)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  {ar ? "اللغة" : "Language"}
                  <select
                    disabled={pending}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as "ar" | "en")}
                  >
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  {ar ? "نبرة المحتوى" : "Tone of voice"}
                  <select
                    disabled={pending}
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                  >
                    <option value="professional">
                      {ar ? "احترافية" : "Professional"}
                    </option>
                    <option value="friendly">{ar ? "ودّية" : "Friendly"}</option>
                    <option value="persuasive">
                      {ar ? "إقناعية" : "Persuasive"}
                    </option>
                  </select>
                </label>
              </div>
              <label>
                {ar ? "كلمات مفتاحية" : "SEO keywords"}
                <input
                  disabled={pending}
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  maxLength={500}
                  placeholder={
                    ar
                      ? "أضف الكلمات، وافصل بينها بفاصلة"
                      : "Add keywords, separated by commas"
                  }
                />
              </label>
              <label>
                {ar ? "ماذا تود أن يعرف Duo؟" : "What should Duo know?"}
                <textarea
                  disabled={pending}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={3000}
                  placeholder={
                    ar
                      ? "شاركنا أهم التفاصيل عن منتجك وجمهورك…"
                      : "Share the important details about your product and audience…"
                  }
                />
              </label>
              <button
                type="submit"
                disabled={!enabled || pending}
                className="btn btn-primary"
              >
                {busy === "text" ? (
                  <LoaderCircle className="animate-spin" size={15} />
                ) : (
                  <Sparkles size={15} />
                )}
                {busy === "text"
                  ? ar
                    ? "Duo يجهّز محتواك…"
                    : "Duo is preparing your content…"
                  : ar
                    ? "توليد المحتوى"
                    : "Generate content"}
              </button>
            </form>
            {textResult && (
              <section className="ai-result" aria-live="polite">
                <div className="card-title">
                  <h2>
                    {ar ? "راجع النتيجة" : "Review your result"} ·{" "}
                    {label(textResult.kind)}
                  </h2>
                  <button type="button" className="btn btn-sm" onClick={copy}>
                    <Copy size={13} />
                    {ar ? "نسخ" : "Copy"}
                  </button>
                </div>
                <p className="form-help">{textResult.productName}</p>
                <label>
                  {ar ? "عدّل النص قبل استخدامه" : "Edit before using"}
                  <textarea
                    value={review}
                    onChange={(e) => {
                      setReview(e.target.value);
                      setSaved((old) =>
                        old.filter((id) => id !== textResult.id),
                      );
                    }}
                    maxLength={textResult.kind === "TITLE" ? 200 : 20000}
                    rows={textResult.kind === "TITLE" ? 3 : 8}
                  />
                </label>
                <div className="form-footer">
                  {textResult.kind !== "SEO" && textResult.productId && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        pending ||
                        !canWrite ||
                        !review.trim() ||
                        saved.includes(textResult.id)
                      }
                      onClick={() => void apply(textResult)}
                    >
                      {applying === textResult.id ? (
                        <LoaderCircle className="animate-spin" size={14} />
                      ) : (
                        <Check size={14} />
                      )}
                      {saved.includes(textResult.id)
                        ? ar
                          ? "تم الحفظ"
                          : "Saved"
                        : textResult.kind === "TITLE"
                          ? ar
                            ? "استخدم كعنوان المنتج"
                            : "Use as product title"
                          : ar
                            ? "استخدم كوصف المنتج"
                            : "Use as product description"}
                    </button>
                  )}
                  {textResult.productId && (
                    <Link
                      className="btn btn-sm"
                      href={`/dashboard/products/${textResult.productId}`}
                    >
                      {ar ? "عرض المنتج" : "View product"}
                      <ArrowUpRight size={13} />
                    </Link>
                  )}
                </div>
                {textResult.kind === "SEO" && (
                  <p className="form-help">
                    {ar
                      ? "الكلمات محفوظة في السجل. انسخها عند تجهيز قائمة منتجك؛ لا تستبدل وصف المنتج تلقائياً."
                      : "Keywords are saved in history. Copy them into your listing; they do not automatically replace the product description."}
                  </p>
                )}
                <Usage result={textResult} ar={ar} />
              </section>
            )}
          </Card>
          <Card>
            <div className="card-title">
              <h2>{ar ? "سجل التوليد" : "Generation history"}</h2>
              <span className="badge">{items.length}</span>
            </div>
            {items.length ? (
              items.map((item) => (
                <article className="ai-history-item" key={item.id}>
                  <div className="ai-history-header">
                    <div>
                      <strong>{label(item.kind)}</strong>
                      <small>
                        {item.productName ||
                          (ar ? "منتج محذوف" : "Deleted product")}
                      </small>
                    </div>
                    <time>
                      {new Date(item.createdAt).toLocaleDateString(
                        ar ? "ar-SA" : "en",
                      )}
                    </time>
                  </div>
                  {item.imageUrl ? (
                    <div className="ai-history-image">
                      <Image
                        src={item.imageUrl}
                        alt={item.productName || "Generated product"}
                        fill
                        unoptimized
                        sizes="180px"
                      />
                    </div>
                  ) : (
                    <p className="detail-description ai-history-preview">
                      {item.content}
                    </p>
                  )}
                  <div className="form-footer">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={pending}
                      onClick={() => {
                        setError("");
                        if (isImageGeneration(item.kind)) setImageResult(item);
                        else {
                          setTextResult(item);
                          setReview(item.content);
                        }
                      }}
                    >
                      {ar ? "مراجعة النتيجة" : "Review result"}
                    </button>
                  </div>
                  <Usage result={item} ar={ar} />
                </article>
              ))
            ) : (
              <EmptyState
                title={
                  ar ? "مساحة لأفكارك القادمة" : "A place for your next ideas"
                }
                description={
                  ar
                    ? "نتائجك الفعلية ستظهر هنا بعد أول عملية توليد."
                    : "Your real results will appear here after your first generation."
                }
              />
            )}
          </Card>
        </div>
        <Card>
          <h2>{ar ? "استوديو الصور" : "Image studio"}</h2>
          <div className="upload-zone">
            <ImagePlus size={34} />
            <strong>
              {ar ? "صورة تليق بمنتجك" : "Give your product a new perspective"}
            </strong>
            <p className="form-help">
              {ar
                ? "أنشئ صورة جديدة أو عدّل صورة من منتجك، ثم راجعها قبل إضافتها."
                : "Create a new image or edit an existing product image, then review before adding it."}
            </p>
          </div>
          <p className="form-help" style={{ marginBlock: 14 }}>
            {product
              ? `${ar ? "المنتج: " : "Product: "}${product.name}`
              : ar
                ? "اختر المنتج أولاً من نموذج المحتوى."
                : "First select a product in the content form."}
          </p>
          {!storage && (
            <div className="notice">
              {ar
                ? "أضف إعدادات R2 لحفظ الصور المولّدة."
                : "Configure R2 to store generated images."}
            </div>
          )}
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void generate(true);
            }}
          >
            <label>
              {ar ? "نوع العملية" : "Image operation"}
              <select
                disabled={pending}
                value={imageMode}
                onChange={(e) => setImageMode(e.target.value)}
              >
                <option value="IMAGE_GENERATION">
                  {ar ? "توليد صورة جديدة" : "Generate a new image"}
                </option>
                <option value="IMAGE_EDIT">
                  {ar ? "تعديل صورة منتج" : "Edit a product image"}
                </option>
              </select>
            </label>
            {imageMode === "IMAGE_EDIT" && (
              <label>
                {ar ? "الصورة الأصلية" : "Source image"}
                <select
                  required
                  disabled={pending}
                  value={imageId}
                  onChange={(e) => setImageId(e.target.value)}
                >
                  <option value="">
                    {ar ? "اختر صورة موجودة" : "Choose an existing image"}
                  </option>
                  {product?.images.map((image, i) => (
                    <option value={image.id} key={image.id}>
                      {ar ? `صورة ${i + 1}` : `Image ${i + 1}`}
                    </option>
                  ))}
                </select>
                {imageId && product?.images.find((im) => im.id === imageId) && (
                  <div className="ai-history-image">
                    <Image
                      src={product.images.find((im) => im.id === imageId)!.url}
                      alt="Source product"
                      fill
                      unoptimized
                      sizes="180px"
                    />
                  </div>
                )}
              </label>
            )}
            <label>
              {ar ? "وصف الصورة" : "Image prompt"}
              <textarea
                required
                disabled={pending}
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                maxLength={3000}
                placeholder={
                  ar
                    ? "مثال: خلفية بيضاء، إضاءة استوديو ناعمة، والمنتج في المنتصف."
                    : "e.g. A clean white background, soft studio lighting, centered product."
                }
              />
            </label>
            <button
              type="submit"
              disabled={
                !enabled ||
                !storage ||
                pending ||
                (imageMode === "IMAGE_EDIT" && !imageId)
              }
              className="btn btn-primary"
            >
              {busy === "image" ? (
                <LoaderCircle className="animate-spin" size={15} />
              ) : (
                <WandSparkles size={15} />
              )}
              {busy === "image"
                ? ar
                  ? "جارٍ تجهيز الصورة…"
                  : "Preparing your image…"
                : imageMode === "IMAGE_EDIT"
                  ? ar
                    ? "تعديل الصورة"
                    : "Edit image"
                  : ar
                    ? "توليد صورة"
                    : "Generate image"}
            </button>
            <p className="form-help">
              {ar
                ? "قد يستغرق التوليد بضع دقائق. راجع دقة المنتج قبل استخدام الصورة."
                : "Generation can take a few minutes. Review product accuracy before using the image."}
            </p>
          </form>
          {imageResult?.imageUrl && (
            <section className="ai-result" aria-live="polite">
              <h3>{ar ? "راجع الصورة" : "Review image"}</h3>
              <p className="form-help">{imageResult.productName}</p>
              <div className="ai-generated-image">
                <Image
                  src={imageResult.imageUrl}
                  alt={imageResult.productName || "Generated product"}
                  fill
                  unoptimized
                  sizes="(max-width:1000px) 80vw, 280px"
                />
              </div>
              <div className="form-footer">
                {imageResult.productId && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      pending || !canWrite || saved.includes(imageResult.id)
                    }
                    onClick={() => void apply(imageResult)}
                  >
                    {applying === imageResult.id ? (
                      <LoaderCircle className="animate-spin" size={14} />
                    ) : (
                      <Check size={14} />
                    )}
                    {saved.includes(imageResult.id)
                      ? ar
                        ? "تمت الإضافة"
                        : "Added"
                      : ar
                        ? "أضف إلى صور المنتج"
                        : "Add to product images"}
                  </button>
                )}
                <a
                  className="btn btn-sm"
                  href={imageResult.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {ar ? "فتح الصورة" : "Open image"}
                </a>
              </div>
              <Usage result={imageResult} ar={ar} />
            </section>
          )}
        </Card>
      </div>
    </>
  );
}
function Usage({ result, ar }: { result: GenerationView; ar: boolean }) {
  return (
    <p className="ai-usage" dir="ltr">
      {result.model} · {result.tokenUsage.toLocaleString()}{" "}
      {ar ? "توكن" : "tokens"} · ~${Number(result.estimatedCost).toFixed(6)} USD
    </p>
  );
}

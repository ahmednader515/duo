import Link from "next/link";
import Image from "next/image";
import {
  Package,
  CircleCheck,
  FileText,
  Plus,
  Sparkles,
  ChartNoAxesCombined,
} from "lucide-react";
import { Card, EmptyState, Mascot } from "@/components/ui";
import { translate, type Language } from "@/lib/i18n";
import type { OverviewData } from "@/lib/data";
export function Stats({
  data,
  language,
}: {
  data: Pick<OverviewData, "total" | "active" | "draft">;
  language: Language;
}) {
  const t = translate(language);
  return (
    <div className="stats-grid">
      {[
        {
          label: t.allProducts,
          value: data.total,
          icon: Package,
          caption:
            language === "ar"
              ? "منتجاتك، في مكان واحد"
              : "Your catalog, in one place",
        },
        {
          label: t.active,
          value: data.active,
          icon: CircleCheck,
          caption:
            language === "ar"
              ? "جاهزة لخطوتك القادمة"
              : "Ready for your next step",
        },
        {
          label: t.draft,
          value: data.draft,
          icon: FileText,
          caption:
            language === "ar"
              ? "خذ وقتك، وجهّز التفاصيل"
              : "Take your time. Get the details right.",
        },
      ].map(({ label, value, icon: Icon, caption }) => (
        <Card className="stat" key={label}>
          <div className="stat-label">
            {label}
            <Icon />
          </div>
          <strong className="stat-value">
            {value.toLocaleString(language === "ar" ? "ar-SA" : "en")}
          </strong>
          <small>{caption}</small>
        </Card>
      ))}
    </div>
  );
}
export function Overview({
  data,
  language,
}: {
  data: OverviewData;
  language: Language;
}) {
  const t = translate(language);
  const ar = language === "ar";
  return (
    <>
      <Stats data={data} language={language} />
      <div className="dashboard-grid">
        <Card>
          <div className="health-header">
            <h2>
              {ar ? "متجرك في نظرة · Duo Health" : "Your store at a glance"}
            </h2>
          </div>
          <div className="health-content">
            <div className="health-ring">
              <Package size={28} strokeWidth={1.4} />
            </div>
            <p>
              {ar
                ? "كل منتج تضيفه هو بداية فرصة جديدة. جهّز متجرك للنمو بخطوات واضحة."
                : "Every product is the start of something new. Get your store ready to grow."}
            </p>
          </div>
        </Card>
        <Card className="duo-summary span-two">
          <h2>{ar ? "خطوتك اليومية مع Duo" : "Your daily moment with Duo"}</h2>
          <p>
            {ar
              ? `عندك ${data.total.toLocaleString("ar-SA")} منتج في مساحة عملك، منها ${data.draft.toLocaleString("ar-SA")} مسودة. خلّنا نجهّز المنتج القادم ونرتّب تفاصيله مع بعض.`
              : `You have ${data.total} products in your workspace, including ${data.draft} drafts. Let's get your next product ready.`}
          </p>
          <Link className="btn" href="/dashboard/products/new">
            <Plus size={14} />
            {t.addProduct}
          </Link>
          <Mascot size="medium" />
        </Card>
      </div>
      <div className="quick-actions">
        <Card>
          <div className="card-title">
            <h2>{t.quick}</h2>
          </div>
          <Link href="/dashboard/products/new" className="quick-item">
            <Plus size={20} />
            <div>
              <strong>{t.addProduct}</strong>
              <small>
                {ar
                  ? "جهّز التفاصيل والصور، وحدّث مخزونك."
                  : "Prepare details and images. Keep stock in view."}
              </small>
            </div>
          </Link>
          <Link href="/dashboard/ai-studio" className="quick-item">
            <Sparkles size={20} />
            <div>
              <strong>{t.ai}</strong>
              <small>
                {ar
                  ? "ولّد المحتوى والصور وراجع النتائج قبل استخدامها."
                  : "Generate content and images, then review before applying."}
              </small>
            </div>
          </Link>
          <p className="form-help">
            {ar
              ? "أنت تراجع وتقرر. Duo يساعدك في الخطوة الجاية."
              : "You review and decide. Duo helps with what comes next."}
          </p>
        </Card>
      </div>
      <div className="dashboard-grid">
        <Card className="span-two">
          <div className="card-title">
            <h2>{t.recentProducts}</h2>
            <Link href="/dashboard/products">{t.viewAll}</Link>
          </div>
          {data.recent.length ? (
            data.recent.map((p) => (
              <Link
                className="mini-product"
                key={p.id}
                href={`/dashboard/products/${p.id}`}
              >
                <span className="product-thumb">
                  {p.images[0] ? (
                    <Image
                      unoptimized
                      src={p.images[0].url}
                      alt=""
                      fill
                      sizes="43px"
                    />
                  ) : (
                    <Package size={20} />
                  )}
                </span>
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {p.price.toString()} {p.currency}
                  </small>
                </div>
                <span
                  className={`badge ${p.status === "ACTIVE" ? "badge-green" : "badge-amber"}`}
                >
                  {p.status === "ACTIVE"
                    ? t.active
                    : p.status === "DRAFT"
                      ? t.draft
                      : t.archived}
                </span>
              </Link>
            ))
          ) : (
            <EmptyState
              title={t.noProducts}
              description={t.noProductsDescription}
              action={
                <Link
                  className="btn btn-primary btn-sm"
                  href="/dashboard/products/new"
                >
                  <Plus size={14} />
                  {t.addProduct}
                </Link>
              }
            />
          )}
        </Card>
        <Card>
          <div className="card-title">
            <h2>{t.activity}</h2>
          </div>
          {data.activity.length ? (
            data.activity.map((a) => (
              <div key={a.id} className="activity-row">
                <span className="activity-dot" />
                <span>
                  {(
                    {
                      WORKSPACE_CREATED: ar
                        ? "إنشاء مساحة العمل"
                        : "Workspace created",
                      PRODUCT_CREATED: ar ? "إضافة منتج" : "Product created",
                      PRODUCT_UPDATED: ar ? "تحديث منتج" : "Product updated",
                      PRODUCT_DELETED: ar ? "حذف منتج" : "Product deleted",
                    } as Record<string, string>
                  )[a.action] || a.action}
                </span>
                <time>
                  {a.createdAt.toLocaleDateString(ar ? "ar-SA" : "en", {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </div>
            ))
          ) : (
            <p className="muted">{t.noActivity}</p>
          )}
          <div
            style={{
              marginTop: 25,
              paddingTop: 18,
              borderTop: "1px solid var(--border)",
            }}
          >
            <div className="stat-label">
              <span>{t.aiUsage}</span>
              <ChartNoAxesCombined size={15} />
            </div>
            <strong className="stat-value" style={{ fontSize: 25 }}>
              {data.usage._count.toLocaleString(ar ? "ar-SA" : "en")}
            </strong>
            <small>
              {ar ? "عملية توليد محتوى وصور" : "content and image generations"}
            </small>
          </div>
        </Card>
      </div>
    </>
  );
}

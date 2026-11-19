"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Brand, Mascot, Card } from "@/components/ui";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/components/providers";
export function Home() {
  const ar = useLanguage() === "ar";
  const steps = ar
    ? [
        ["١", "أنشئ مساحة عملك", "مساحة تجمع منتجاتك ومخزونك وفريقك في مكان واحد."],
        [
          "٢",
          "أضف منتجاتك مرة واحدة",
          "جهّز تفاصيل المنتج، وصوره، ومخزونه.",
        ],
        ["٣", "اترك Duo يتابع", "جهّز المحتوى والصور بمساعدة الذكاء الاصطناعي، وأنت تقرر وتوافق."],
      ]
    : [
        [
          "1",
          "Create your workspace",
          "One place for your products, inventory, and team.",
        ],
        [
          "2",
          "Add your products once",
          "Organize product details, images, and inventory.",
        ],
        [
          "3",
          "Let Duo help you grow",
          "Prepare content and images with AI. You review and approve.",
        ],
      ];
  return (
    <div className="landing">
      <header className="marketing-nav">
        <div className="nav-inner">
          <Brand />
          <nav className="marketing-links">
            <a href="#how-it-works">{ar ? "كيف يعمل" : "How it works"}</a>
            <a href="#features">{ar ? "المميزات" : "Features"}</a>
            <a href="#start">{ar ? "ابدأ" : "Get started"}</a>
          </nav>
          <div className="nav-actions">
            <LanguageSwitch />
            <Link href="/login" className="btn">
              {ar ? "تسجيل الدخول" : "Log in"}
            </Link>
            <Link href="/register" className="btn btn-primary">
              {ar ? "ابدأ الآن" : "Get started"}
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className="hero">
          <span className="eyebrow">
            {ar
              ? "قريباً · نسختك الجديدة من التجارة"
              : "A fresh perspective on commerce"}
          </span>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Mascot size="large" />
          </motion.div>
          <div className="hero-bubble">
            {ar
              ? "أنا Duo، جارك الواعي ورفيقك في تجارتك. أنا أجهّز، وأنت توافق. وش نسوي؟"
              : "I'm Duo, your thoughtful commerce companion. I prepare. You approve. What shall we work on?"}
          </div>
          <div className="hero-chips">
            {(ar
              ? [
                  "أضف منتجاً",
                  "راجع المنتجات",
                  "حلّل المبيعات",
                  "ردّ على العملاء",
                  "جهّز التقرير",
                ]
              : [
                  "Add a product",
                  "Review products",
                  "Understand sales",
                  "Support customers",
                  "Prepare reports",
                ]
            ).map((v, i) => (
              <a href={i === 0 ? "/register" : "#features"} key={v}>
                {v}
              </a>
            ))}
          </div>
          <h1>
            {ar ? (
              <>
                تجارة أذكى.
                <br />
                <span>نمو أسهل.</span>
              </>
            ) : (
              <>
                Smarter commerce.
                <br />
                <span>Easier growth.</span>
              </>
            )}
          </h1>
          <p className="hero-copy">
            {ar
              ? "أدِر منتجاتك ومخزونك في داشبورد واحد. جهّز المحتوى والصور بمساعدة الذكاء الاصطناعي، وتابع فريقك بكل وضوح."
              : "Manage products and inventory in one dashboard. Prepare content and images with AI, and keep your team in sync."}
          </p>
          <div className="hero-actions">
            <Link href="/register" className="btn btn-primary">
              {ar ? "ابدأ الآن" : "Start your workspace"}
            </Link>
            <a className="btn" href="#how-it-works">
              {ar ? "شاهد كيف يعمل" : "See how it works"}
            </a>
          </div>
        </section>
        <section id="how-it-works" className="landing-section">
          <div className="section-heading">
            <small>{ar ? "كيف يعمل" : "How it works"}</small>
            <h2>{ar ? "ثلاث خطوات ونبدأ" : "Three steps. One fresh start."}</h2>
          </div>
          <div className="steps-grid">
            {steps.map(([n, title, copy]) => (
              <Card className="step" key={n}>
                <strong>{n}</strong>
                <h3>{title}</h3>
                <p>{copy}</p>
              </Card>
            ))}
          </div>
        </section>
        <section id="features" className="landing-section">
          <div className="section-heading">
            <small>{ar ? "المميزات" : "Built for your business"}</small>
            <h2>
              {ar
                ? "كل ما يحتاجه متجرك في مكان واحد"
                : "Everything your store needs, together"}
            </h2>
          </div>
          <div className="features-grid">
            <Card className="feature">
              <h3>
                {ar ? "أضف المنتج مرة واحدة" : "One product. Every detail."}
              </h3>
              <p>
                {ar
                  ? "رتّب تفاصيل منتجاتك وصورها ومخزونها."
                  : "A thoughtful home for product details and inventory."}
              </p>
              <div className="mini-panel">
                {(ar ? ["تفاصيل المنتج", "صور المنتج", "المخزون"] : ["Product details", "Product images", "Inventory"]).map((p, i) => (
                  <div className="mini-row" key={p}>
                    <span>{p}</span>
                    <span
                      className={`badge ${i === 2 ? "badge-amber" : "badge-green"}`}
                    >
                      {ar
                        ? i === 2
                          ? "جاهز للمراجعة"
                          : "منتج جاهز"
                        : i === 2
                          ? "Review"
                          : "Ready"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="feature">
              <h3>{ar ? "اسأل Duo" : "Meet your next assistant"}</h3>
              <p>
                {ar
                  ? "مساعد يفهم متجرك ويساعدك في أي وقت. قريباً."
                  : "Thoughtful assistance for your daily work. Coming soon."}
              </p>
              <div className="mini-panel">
                <div className="chat-right">
                  {ar
                    ? "كيف أحسّن وصف المنتج؟"
                    : "How can I improve this description?"}
                </div>
                <div className="chat-left">
                  {ar
                    ? "اقتراحات واضحة، تراجعها وتوافق عليها بنفسك."
                    : "Clear suggestions, ready for your review and approval."}
                </div>
              </div>
            </Card>
            <Card className="feature">
              <h3>
                {ar
                  ? "كل المنتجات في شاشة واحدة"
                  : "Your entire catalog, in view"}
              </h3>
              <p>
                {ar
                  ? "أضف المنتج وعدّله دون التنقل بين الصفحات."
                  : "Organize your products without losing the bigger picture."}
              </p>
              <div className="mini-panel">
                {(ar ? ["نشط", "مسودة"] : ["Active", "Draft"]).map((p) => (
                  <div className="mini-row" key={p}>
                    <span>{ar ? "منتجات متجرك" : "Your store products"}</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="feature">
              <h3>{ar ? "تقرير يشرح الصورة" : "Clarity for your next move"}</h3>
              <p>
                {ar
                  ? "كل مؤشرات منتجاتك، بدون أرقام تخمينية."
                  : "Real product statistics. Useful business context."}
              </p>
              <div className="tags">
                {(ar
                  ? [
                      "المنتجات",
                      "المخزون",
                      "المسودات",
                      "التصنيفات",
                      "الصور",
                      "نشاط الفريق",
                    ]
                  : [
                      "Products",
                      "Inventory",
                      "Drafts",
                      "Categories",
                      "Images",
                      "Team activity",
                    ]
                ).map((v) => (
                  <span key={v}>{v}</span>
                ))}
              </div>
            </Card>
            <Card className="feature">
              <h3>{ar ? "مساحة لفريقك بالكامل" : "A shared place to work"}</h3>
              <p>
                {ar
                  ? "مساحة عمل مستقلة، بصلاحيات واضحة لكل عضو."
                  : "Separate workspaces. Clear roles for every member."}
              </p>
              <div className="mini-panel">
                <div className="mini-row">
                  {ar ? "مالك المتجر" : "Workspace owner"}
                  <span className="badge badge-green">OWNER</span>
                </div>
                <div className="mini-row">
                  {ar ? "فريق المنتجات" : "Product team"}
                  <span className="badge">MEMBER</span>
                </div>
              </div>
            </Card>
            <Card className="feature">
              <h3>{ar ? "أنت تضع القواعد" : "You set the direction"}</h3>
              <p>
                {ar
                  ? "Duo يجهّز المحتوى والصور وأنت تراجع وتقرر."
                  : "Duo prepares. You decide. Always in your control."}
              </p>
              <div className="mini-panel rules-preview">
                <strong>
                  {ar ? "## الخطة لك" : "## Your business, your rules"}
                </strong>
                {ar ? (
                  <>
                    لا محتوى بدون مراجعتك.
                    <br />
                    واحفظ ما يناسب منتجاتك.
                  </>
                ) : (
                  <>
                    Review every suggestion.
                    <br />
                    Save what works for your products.
                  </>
                )}
              </div>
            </Card>
          </div>
        </section>
        <section id="start" className="landing-section">
          <Card className="cta">
            <h2>{ar ? "وش نبي ننجز اليوم؟" : "What will you build today?"}</h2>
            <p>
              {ar
                ? "ابدأ بمنتجك الأول، وخلّ تجارتك تأخذ مساحة أكبر."
                : "Start with your first product. Make space for something bigger."}
            </p>
            <Link href="/register" className="btn btn-primary">
              {ar ? "ابدأ الآن" : "Let's get started"}
            </Link>
          </Card>
        </section>
      </main>
      <footer className="footer">
        <div>
          <strong style={{ fontFamily: "Inter" }}>Duo</strong>
          <p className="muted">
            {ar ? "تجارة أذكى. نمو أسهل." : "Smarter commerce. Easier growth."}
          </p>
        </div>
        <div>
          <strong>{ar ? "المنتج" : "Product"}</strong>
          <a href="#features">{ar ? "المميزات" : "Features"}</a>
          <a href="#how-it-works">{ar ? "كيف يعمل" : "How it works"}</a>
        </div>
        <div>
          <strong>{ar ? "حسابك" : "Your workspace"}</strong>
          <Link href="/register">
            {ar ? "إنشاء حساب" : "Create an account"}
          </Link>
          <Link href="/login">{ar ? "تسجيل الدخول" : "Log in"}</Link>
        </div>
        <div>
          <strong>{ar ? "خطوة جديدة" : "A fresh start"}</strong>
          <p className="muted">
            {ar
              ? "صُمم لتجارتك، من أول منتج."
              : "Built for your business, from the first product."}
          </p>
        </div>
      </footer>
    </div>
  );
}

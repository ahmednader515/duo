"use client";
import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Brand, Mascot } from "@/components/ui";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/components/providers";
export function AuthForm({
  mode,
  configured,
}: {
  mode: "login" | "register" | "forgot";
  configured: boolean;
}) {
  const ar = useLanguage() === "ar";
  const register = mode === "register";
  const forgot = mode === "forgot";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (register) {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        toast.success(
          ar ? "تم إنشاء حسابك ومساحة عملك" : "Your workspace is ready",
        );
      }
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (result?.error)
        throw new Error(
          ar
            ? "تعذر الدخول. تحقق من بياناتك أو حاول لاحقاً."
            : "Unable to sign in. Check your credentials or try again later.",
        );
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to connect");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-aside">
        <Mascot size="large" />
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
        <p>
          {ar
            ? "كل ما يحتاجه متجرك، في مكان واحد. خلّنا نبدأ الخطوة الجاية مع بعض."
            : "Everything your store needs, in one place. Let's take the next step together."}
        </p>
      </section>
      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-top">
            <Brand />
            <LanguageSwitch />
          </div>
          <h2>
            {ar
              ? forgot
                ? "نسيت كلمة المرور؟"
                : register
                  ? "خلّنا نبدأ مع بعض"
                  : "أهلاً بعودتك"
              : forgot
                ? "Forgot your password?"
                : register
                  ? "A new chapter starts here"
                  : "Welcome back"}
          </h2>
          <p>
            {ar
              ? register
                ? "أنشئ حسابك ومساحة عملك، وأضف منتجك الأول."
                : "منتجاتك وفريقك، بانتظارك في مكان واحد."
              : register
                ? "Create your account, set up your workspace, and add your first product."
                : "Your products and team, together in one place."}
          </p>
          {forgot ? (
            <>
              <div className="notice">
                {ar
                  ? "استعادة كلمة المرور غير متاحة حالياً. يلزم إعداد خدمة بريد إلكتروني موثوقة قبل تفعيلها. لم يتم إرسال أي بريد."
                  : "Password reset is currently unavailable. A verified email delivery service must be configured before enabling resets. No email has been sent."}
              </div>
              <Link className="btn" href="/login">
                <ArrowLeft size={15} />
                {ar ? "العودة لتسجيل الدخول" : "Back to login"}
              </Link>
            </>
          ) : (
            <>
              {!configured && (
                <div className="notice">
                  {ar
                    ? "الحسابات غير متاحة بعد. أضف إعدادات Neon و AUTH_SECRET في ملف البيئة لبدء الاستخدام."
                    : "Accounts are not available yet. Configure Neon and AUTH_SECRET in your environment to get started."}
                </div>
              )}
              <form onSubmit={submit}>
                {register && (
                  <>
                    <label>
                      {ar ? "اسمك" : "Your name"}
                      <input
                        name="name"
                        autoComplete="name"
                        minLength={2}
                        maxLength={100}
                        required
                        placeholder={ar ? "كيف نناديك؟" : "Your full name"}
                      />
                    </label>
                    <label>
                      {ar ? "اسم متجرك" : "Workspace name"}
                      <input
                        name="workspace"
                        minLength={2}
                        maxLength={100}
                        required
                        placeholder={
                          ar ? "اسم نشاطك التجاري" : "Your business name"
                        }
                      />
                    </label>
                  </>
                )}
                <label>
                  {ar ? "البريد الإلكتروني" : "Email address"}
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    dir="ltr"
                    required
                    placeholder="you@yourstore.com"
                  />
                </label>
                <label>
                  {ar ? "كلمة المرور" : "Password"}
                  <input
                    name="password"
                    type="password"
                    autoComplete={
                      register ? "new-password" : "current-password"
                    }
                    minLength={12}
                    maxLength={72}
                    dir="ltr"
                    required
                    placeholder="••••••••••••"
                  />
                  {register && (
                    <small>
                      {ar
                        ? "12 حرفاً على الأقل. استخدم كلمة مرور فريدة."
                        : "At least 12 characters. Use a unique password."}
                    </small>
                  )}
                </label>
                {!register && (
                  <Link
                    style={{ fontSize: 11, color: "#bd3d60" }}
                    href="/forgot-password"
                  >
                    {ar ? "نسيت كلمة المرور؟" : "Forgot password?"}
                  </Link>
                )}
                {error && (
                  <div role="alert" className="error-message">
                    {error}
                  </div>
                )}
                <button
                  disabled={!configured || busy}
                  className="btn btn-primary"
                  type="submit"
                >
                  {busy && <LoaderCircle className="animate-spin" size={16} />}
                  {ar
                    ? register
                      ? "أنشئ حسابي"
                      : "تسجيل الدخول"
                    : register
                      ? "Create my account"
                      : "Log in"}
                </button>
              </form>
              <div className="auth-links">
                {ar
                  ? register
                    ? "عندك حساب بالفعل؟ "
                    : "جديد على Duo؟ "
                  : register
                    ? "Already have an account? "
                    : "New to Duo? "}
                <Link href={register ? "/login" : "/register"}>
                  {ar
                    ? register
                      ? "سجل الدخول"
                      : "ابدأ الآن"
                    : register
                      ? "Log in"
                      : "Get started"}
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

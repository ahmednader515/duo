"use client";
import { useLanguage } from "@/components/providers";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const ar = useLanguage() === "ar";
  return (
    <div className="card">
      <h2>{ar ? "تعذر تحميل مساحة العمل" : "Couldn't load your workspace"}</h2>
      <p className="muted">
        {ar
          ? "تحقق من اتصال قاعدة البيانات وإعدادات التطبيق، ثم حاول مرة أخرى."
          : "Check your database connection and application configuration, then try again."}
      </p>
      <button className="btn btn-primary" onClick={reset}>
        {ar ? "حاول مرة أخرى" : "Try again"}
      </button>
    </div>
  );
}

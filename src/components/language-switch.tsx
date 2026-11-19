"use client";
import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers";
export function LanguageSwitch() {
  const language = useLanguage();
  const router = useRouter();
  return (
    <button
      className="language-button"
      onClick={() => {
        document.cookie = `duo-language=${language === "ar" ? "en" : "ar"};path=/;max-age=31536000;SameSite=Lax`;
        router.refresh();
      }}
      aria-label={
        language === "ar" ? "Switch to English" : "التبديل إلى العربية"
      }
    >
      <Languages size={16} />
      {language === "ar" ? "EN" : "عربي"}
    </button>
  );
}

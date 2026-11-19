"use client";
import { createContext, useContext } from "react";
import { Toaster } from "sonner";
import type { Language } from "@/lib/i18n";
const LanguageContext = createContext<Language>("ar");
export const useLanguage = () => useContext(LanguageContext);
export function Providers({
  language,
  children,
}: {
  language: Language;
  children: React.ReactNode;
}) {
  return (
    <LanguageContext.Provider value={language}>
      {children}
      <Toaster
        richColors
        position="bottom-center"
        dir={language === "ar" ? "rtl" : "ltr"}
      />
    </LanguageContext.Provider>
  );
}

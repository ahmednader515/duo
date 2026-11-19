import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Duo — تجارة أذكى. نمو أسهل.", template: "%s | Duo" },
  description:
    "كل ما يحتاجه متجرك في مكان واحد. Manage products, inventory, and your next stage of growth with Duo.",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const language =
    (await cookies()).get("duo-language")?.value === "en" ? "en" : "ar";
  return (
    <html
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
      data-scroll-behavior="smooth"
    >
      <body>
        <Providers language={language}>{children}</Providers>
      </body>
    </html>
  );
}

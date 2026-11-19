"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutGrid,
  Package,
  Sparkles,
  ChartNoAxesCombined,
  Settings,
  Search,
  Bell,
  Menu,
  LogOut,
  UserRound,
  X,
} from "lucide-react";
import { Brand } from "@/components/ui";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/components/providers";
import { translate } from "@/lib/i18n";
import { switchWorkspace } from "@/actions/settings";
import { toast } from "sonner";
type Props = {
  children: React.ReactNode;
  workspaceId: string;
  memberships: { workspaceId: string; workspace: { name: string } }[];
  name: string;
  email: string;
};
export function DashboardShell({
  children,
  workspaceId,
  memberships,
  name,
  email,
}: Props) {
  const language = useLanguage();
  const t = translate(language);
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState<"notifications" | "user" | null>(null);
  const popover = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function dismiss(event: MouseEvent) {
      if (popover.current && !popover.current.contains(event.target as Node))
        setOpen(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(null);
        setMobile(false);
      }
    }
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const nav = [
    { href: "/dashboard", key: "overview", icon: LayoutGrid },
    { href: "/dashboard/products", key: "products", icon: Package },
    { href: "/dashboard/ai-studio", key: "ai", icon: Sparkles },
    {
      href: "/dashboard/analytics",
      key: "analytics",
      icon: ChartNoAxesCombined,
    },
  ] as const;
  const current = [...nav]
    .reverse()
    .find(
      (n) =>
        pathname === n.href ||
        (n.href !== "/dashboard" && pathname.startsWith(n.href)),
    );
  return (
    <div className="dashboard-shell">
      {mobile && (
        <div
          className="mobile-overlay"
          onClick={() => setMobile(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <button
          type="button"
          className="icon-button sidebar-close"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X size={17} />
        </button>
        <Brand tagline />
        <div className="workspace-select">
          <span className="workspace-avatar">
            {memberships
              .find((m) => m.workspaceId === workspaceId)
              ?.workspace.name.charAt(0)}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <small>{t.workspace}</small>
            <select
              aria-label={t.workspace}
              value={workspaceId}
              onChange={async (e) => {
                try {
                  await switchWorkspace(e.target.value);
                } catch {
                  toast.error("Could not switch workspace");
                }
              }}
            >
              {memberships.map((m) => (
                <option key={m.workspaceId} value={m.workspaceId}>
                  {m.workspace.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <nav
          aria-label={
            language === "ar" ? "القائمة الرئيسية" : "Main navigation"
          }
        >
          {nav.map(({ href, key, icon: Icon }) => (
            <div key={href}>
              {key === "ai" && (
                <p className="nav-group-label">
                  {language === "ar" ? "أدوات النمو" : "TOOLS FOR GROWTH"}
                </p>
              )}
              <Link
                className={`nav-item ${pathname === href || (href !== "/dashboard" && pathname.startsWith(href)) ? "active" : ""}`}
                href={href}
                onClick={() => setMobile(false)}
              >
                <Icon />
                {t[key]}
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            onClick={() => setMobile(false)}
            href="/dashboard/settings"
            className={`nav-item ${pathname === "/dashboard/settings" ? "active" : ""}`}
          >
            <Settings size={18} />
            {t.settings}
          </Link>
        </div>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={18} />
            </button>
            <div>
              <h1>
                {pathname.startsWith("/dashboard/settings")
                  ? t.settings
                  : current
                    ? t[current.key]
                    : t.overview}
              </h1>
              <p>{t.welcome}</p>
            </div>
          </div>
          <div className="header-tools" ref={popover}>
            <form className="search-box" action="/dashboard/products">
              <Search />
              <input name="q" placeholder={t.search} aria-label={t.search} />
            </form>
            <LanguageSwitch />
            <div className="header-popover">
              <button
                className="icon-button"
                aria-label="Notifications"
                aria-expanded={open === "notifications"}
                onClick={() =>
                  setOpen(open === "notifications" ? null : "notifications")
                }
              >
                <Bell size={17} />
              </button>
              {open === "notifications" && (
                <div className="popover-panel">
                  <h3>{language === "ar" ? "التنبيهات" : "Notifications"}</h3>
                  <p>
                    {language === "ar"
                      ? "ما عندك تنبيهات جديدة. أنت على اطلاع بكل شيء."
                      : "You're all caught up. No new notifications."}
                  </p>
                </div>
              )}
            </div>
            <div className="header-popover">
              <button
                className="icon-button avatar-button"
                aria-label="Account menu"
                aria-expanded={open === "user"}
                onClick={() => setOpen(open === "user" ? null : "user")}
              >
                {name.charAt(0)}
              </button>
              {open === "user" && (
                <div className="popover-panel">
                  <h3>{name}</h3>
                  <p dir="ltr">{email}</p>
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setOpen(null)}
                  >
                    <UserRound size={15} />
                    {t.profile}
                  </Link>
                  <button onClick={() => signOut({ callbackUrl: "/login" })}>
                    <LogOut size={15} />
                    {t.signout}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

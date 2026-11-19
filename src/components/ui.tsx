import Link from "next/link";
import { PackageOpen, Sparkles } from "lucide-react";
import { Mascot } from "@/components/mascot";
export { Mascot };
export function Brand({ tagline = false }: { tagline?: boolean }) {
  return (
    <Link href="/" className="brand">
      <Mascot />
      <span>
        <strong>Duo</strong>
        {tagline && <small>تجارة أذكى. نمو أسهل.</small>}
      </span>
    </Link>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <PackageOpen size={30} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Soon({ text = "Coming soon" }: { text?: string }) {
  return (
    <span className="badge badge-amber">
      <Sparkles size={11} />
      {text}
    </span>
  );
}

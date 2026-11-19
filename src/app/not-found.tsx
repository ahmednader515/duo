import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-state" style={{ paddingTop: "20vh" }}>
      <h1>404</h1>
      <h2>هذه الصفحة غير موجودة · Page not found</h2>
      <Link className="btn btn-primary" href="/">
        Duo →
      </Link>
    </main>
  );
}

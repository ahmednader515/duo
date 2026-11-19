import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Log in" };
export default function Page() {
  return (
    <AuthForm
      mode="login"
      configured={Boolean(process.env.DATABASE_URL && process.env.AUTH_SECRET)}
    />
  );
}

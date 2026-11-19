import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Password reset" };
export default function Page() {
  return <AuthForm mode="forgot" configured={false} />;
}

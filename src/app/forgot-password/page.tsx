import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotForm } from "@/components/auth/forms";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      lede="Supabase sends the reset email. Locally that message lands in Mailpit, not a real inbox."
      footer={
        <Link href="/login" className="text-amber">
          Back to sign in
        </Link>
      }
    >
      <ForgotForm />
    </AuthCard>
  );
}

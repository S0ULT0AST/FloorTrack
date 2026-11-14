import { AuthCard } from "@/components/auth/auth-card";
import { ResetForm } from "@/components/auth/forms";

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Choose a new password"
      lede="At least 8 characters. After this, sign in with the new password."
    >
      <ResetForm />
    </AuthCard>
  );
}

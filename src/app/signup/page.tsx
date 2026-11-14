import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/forms";

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create an account"
      lede="This creates your login. It does not make you an admin of a store. Platform owners are named in server config. Everyone else joins a company by invite or approval."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" className="text-amber">
            Sign in
          </Link>
        </p>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}

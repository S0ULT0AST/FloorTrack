import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/forms";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading sign in…</p>}>
      <LoginScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginScreen({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Sign in"
      lede="Use the email on your FloorTrack account. Passwords stay with Supabase Auth — nothing is hashed in the browser."
      footer={
        <p>
          New here?{" "}
          <Link href="/signup" className="text-amber">
            Create an account
          </Link>
          . Company staff still need an invite or an approval.
        </p>
      }
    >
      <LoginForm next={params.next} />
    </AuthCard>
  );
}

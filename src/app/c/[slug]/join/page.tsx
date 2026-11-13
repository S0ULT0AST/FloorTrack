import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "@/components/auth/auth-card";
import { JoinForm } from "@/components/invite/join-form";

export default function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Opening the company…</p>}>
      <JoinScreen params={params} />
    </Suspense>
  );
}

async function JoinScreen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("preview_join", { slug });
  const preview = (data ?? { found: false }) as {
    found: boolean;
    name?: string;
    status?: string;
    account_access_mode?: string;
  };

  if (!preview.found) {
    return (
      <AuthCard title="Company not found" lede="Check the link with the person who sent it.">
        <Link href="/login" className="text-amber">
          Sign in
        </Link>
      </AuthCard>
    );
  }

  if (preview.status !== "active") {
    return (
      <AuthCard title={preview.name ?? "Company"} lede="This company is not accepting people right now.">
        <Link href="/login" className="text-amber">
          Sign in
        </Link>
      </AuthCard>
    );
  }

  if (preview.account_access_mode !== "self_signup_with_approval") {
    return (
      <AuthCard
        title={preview.name ?? "Company"}
        lede="This company invites people by email. Self sign-up is closed. Ask a manager for a link."
      >
        <Link href="/login" className="text-amber">
          Sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={`Request access to ${preview.name}`}
      lede="You'll land as a guest until a manager assigns a role. You can look at the floor, not change it."
    >
      <JoinForm slug={slug} />
    </AuthCard>
  );
}

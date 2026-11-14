import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm, SignUpForm } from "@/components/auth/forms";
import { AcceptInviteForm } from "@/components/invite/accept-form";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Opening invite…</p>}>
      <InviteScreen params={params} />
    </Suspense>
  );
}

async function InviteScreen({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_invite", { token });
  const preview = (data ?? { found: false }) as {
    found: boolean;
    company_name?: string;
    email?: string;
    username?: string;
    role_name?: string;
  };
  if (error || !preview.found) {
    return (
      <AuthCard title="Invite unavailable" lede="This link is invalid, expired, or already used. Ask a manager for a new one.">
        <Link href="/login" className="text-amber">
          Sign in
        </Link>
      </AuthCard>
    );
  }

  const { data: claims } = await supabase.auth.getClaims();
  const signedInEmail = String(claims?.claims?.email ?? "").toLowerCase();

  return (
    <AuthCard
      title={`Join ${preview.company_name}`}
      lede={`${preview.username} will be a ${preview.role_name}. Sign in as ${preview.email}, then accept.`}
    >
      {signedInEmail === preview.email ? (
        <AcceptInviteForm token={token} />
      ) : signedInEmail ? (
        <p className="text-sm text-danger">
          You are signed in as {signedInEmail}. This invite is for {preview.email}. Sign out and use that email.
        </p>
      ) : (
        <div className="grid gap-8">
          <div>
            <h2 className="font-semibold">New to FloorTrack</h2>
            <SignUpForm next={`/invite/${token}`} />
          </div>
          <div>
            <h2 className="font-semibold">Already have a login</h2>
            <LoginForm next={`/invite/${token}`} />
          </div>
        </div>
      )}
    </AuthCard>
  );
}

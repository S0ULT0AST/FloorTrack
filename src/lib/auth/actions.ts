"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensurePlatformOwner, landingPath, readContext } from "@/lib/auth/session";
import type { ActionState } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { appOrigin, safeNextPath } from "@/lib/utils";

function passwordError(password: string) {
  if (password.length < 8) return "Use at least 8 characters.";
  return null;
}

export async function signIn(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Email or password doesn't match." };
  }
  await ensurePlatformOwner();
  const context = await readContext();
  redirect(next !== "/" ? next : await landingPath(context));
}

export async function signUp(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const passwordProblem = passwordError(password);
  if (passwordProblem) return { error: passwordProblem };
  if (!email.includes("@")) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appOrigin()}/auth/callback`,
      data: displayName ? { display_name: displayName } : undefined,
    },
  });
  if (error) return { error: error.message };
  if (!data.session) {
    return {
      ok: "Check your email to confirm the account, then sign in.",
    };
  }
  await ensurePlatformOwner();
  if (next !== "/") redirect(next);
  const context = await readContext();
  redirect(await landingPath(context));
}

export async function requestPasswordReset(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error) return { error: error.message };
  return {
    ok: "If that email has an account, a reset link is on its way. Locally, open the Mailpit inbox.",
  };
}

export async function updatePassword(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const passwordProblem = passwordError(password);
  if (passwordProblem) return { error: passwordProblem };
  if (password !== confirm) return { error: "Those passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/account?password=updated");
}

export async function changePassword(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const passwordProblem = passwordError(password);
  if (passwordProblem) return { error: passwordProblem };
  if (password !== confirm) return { error: "Those passwords don't match." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = String(claims?.claims?.email ?? "");
  if (!email) return { error: "Sign in again before changing your password." };

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: current,
  });
  if (reauthError) return { error: "Current password doesn't match." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: "Password updated." };
}

export async function changeEmail(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const current = String(formData.get("current") ?? "");
  if (!email.includes("@")) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const currentEmail = String(claims?.claims?.email ?? "");
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: currentEmail,
    password: current,
  });
  if (reauthError) return { error: "Current password doesn't match." };

  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${appOrigin()}/auth/callback` },
  );
  if (error) return { error: error.message };
  return { ok: "Confirm the link sent to the new address. The old address may need to confirm too." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const jar = await cookies();
  jar.delete("ft_company");
  jar.delete("ft_store");
  redirect("/login");
}

export async function setActiveCompany(formData: FormData) {
  const companyId = String(formData.get("company_id") ?? "");
  const jar = await cookies();
  jar.set("ft_company", companyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  jar.delete("ft_store");
  redirect("/map");
}

export async function setActiveStore(formData: FormData) {
  const storeId = String(formData.get("store_id") ?? "");
  const jar = await cookies();
  if (!storeId) {
    jar.delete("ft_store");
  } else {
    jar.set("ft_store", storeId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
  }
  redirect("/map");
}

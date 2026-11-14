"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

function message(error: { message: string } | null) {
  return error?.message ?? "Something went wrong.";
}

export async function createCompany(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const names = formData.getAll("site_name").map((value) => String(value));
  const types = formData.getAll("site_type").map((value) => String(value));
  const timezones = formData.getAll("site_timezone").map((value) => String(value));
  const sites = names
    .map((name, index) => ({
      name: name.trim(),
      type: types[index],
      timezone: timezones[index]?.trim() || null,
    }))
    .filter((site) => site.name.length > 0);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_company", {
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    timezone: String(formData.get("timezone") ?? ""),
    account_access_mode: String(formData.get("account_access_mode") ?? ""),
    sites,
    manager_email: String(formData.get("manager_email") ?? "").trim().toLowerCase(),
    manager_username: String(formData.get("manager_username") ?? "").trim().toLowerCase(),
    manager_role: String(formData.get("manager_role") ?? "manager"),
  });
  if (error) return { error: message(error) };
  const payload = data as { company_id: string; invite_token: string };
  redirect(
    `/owner/companies/${payload.company_id}?invite=${encodeURIComponent(payload.invite_token)}`,
  );
}

export async function setCompanyStatus(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_company_status", {
    company_id: String(formData.get("company_id") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/owner");
}

export async function updateCompanySettings(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const companyId = String(formData.get("company_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_company_settings", {
    company_id: companyId,
    name: String(formData.get("name") ?? "").trim(),
    timezone: String(formData.get("timezone") ?? ""),
    account_access_mode: String(formData.get("account_access_mode") ?? ""),
  });
  if (error) return { error: message(error) };
  revalidatePath("/settings");
  return { ok: "Company settings saved." };
}

export async function createSite(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_site", {
    company_id: String(formData.get("company_id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    site_type: String(formData.get("site_type") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
  });
  if (error) return { error: message(error) };
  revalidatePath("/settings");
  return { ok: "Site added." };
}

export async function updateSite(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_site", {
    site_id: String(formData.get("site_id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    site_type: String(formData.get("site_type") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
    active: formData.get("active") === "true",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function createInvite(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invite", {
    company_id: String(formData.get("company_id") ?? ""),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    role_key: String(formData.get("role_key") ?? ""),
    username: String(formData.get("username") ?? "").trim().toLowerCase(),
  });
  if (error) return { error: message(error) };
  const payload = data as { invite_token: string };
  return {
    ok: `Invite ready. Share this link: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:43123"}/invite/${payload.invite_token}`,
  };
}

export async function reissueInvite(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reissue_invite", {
    invite_id: String(formData.get("invite_id") ?? ""),
  });
  if (error) return { error: message(error) };
  const payload = data as { invite_token: string };
  return {
    ok: `New link: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:43123"}/invite/${payload.invite_token}`,
  };
}

export async function revokeInvite(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invite", {
    invite_id: String(formData.get("invite_id") ?? ""),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/team");
}

export async function acceptInvite(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { token });
  if (error) return { error: message(error) };
  redirect("/map");
}

export async function requestToJoin(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    if (password.length < 8) return { error: "Use at least 8 characters." };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:43123"}/auth/callback?next=/c/${slug}/join` },
    });
    if (error) return { error: error.message };
    if (!data.session) {
      return { ok: "Confirm your email, sign in, and open this page again to request access." };
    }
  }

  const { error } = await supabase.rpc("request_to_join", { slug, username });
  if (error) return { error: message(error) };
  redirect("/pending");
}

export async function reviewJoinRequest(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_join_request", {
    request_id: String(formData.get("request_id") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    role_key: String(formData.get("role_key") ?? ""),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/team");
}

export async function setMemberRole(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    membership_id: String(formData.get("membership_id") ?? ""),
    role_key: String(formData.get("role_key") ?? ""),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/team");
}

export async function setMemberStatus(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_status", {
    membership_id: String(formData.get("membership_id") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/team");
}

export async function setMyUsername(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_username", {
    company_id: String(formData.get("company_id") ?? ""),
    username: String(formData.get("username") ?? "").trim().toLowerCase(),
  });
  if (error) return { error: message(error) };
  revalidatePath("/account");
  return { ok: "Username updated." };
}

export async function setHomeStore(formData: FormData) {
  const supabase = await createClient();
  const storeId = String(formData.get("store_id") ?? "");
  const { error } = await supabase.rpc("set_home_store", {
    company_id: String(formData.get("company_id") ?? ""),
    store_id: storeId || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/account");
}

export async function setMyTheme(theme: "light" | "dark") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_theme", { theme });
  if (error) throw new Error(error.message);
}

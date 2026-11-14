import type { PermissionMap } from "@/lib/permissions";

export type SiteType = "warehouse" | "retail";
export type AccountAccessMode = "invite" | "self_signup_with_approval";
export type MembershipStatus = "pending" | "active" | "disabled";
export type CompanyStatus = "active" | "suspended";

export type StoreSummary = {
  id: string;
  name: string;
  type: SiteType;
  active: boolean;
  timezone: string | null;
};

export type MembershipContext = {
  membership_id: string;
  company_id: string;
  company_name: string;
  company_slug: string;
  company_status: CompanyStatus;
  timezone: string;
  account_access_mode: AccountAccessMode;
  status: MembershipStatus;
  username: string;
  role_key: string;
  role_name: string;
  role_color: string;
  permissions: PermissionMap;
  primary_store_id: string | null;
  stores: StoreSummary[];
};

export type AppContext = {
  signed_in: boolean;
  user_id?: string;
  email?: string;
  display_name?: string;
  theme?: "light" | "dark";
  is_platform_admin?: boolean;
  memberships?: MembershipContext[];
};

export type ActionState = { error?: string; ok?: string } | null;

export const ACCESS_MODE_LABEL: Record<AccountAccessMode, string> = {
  invite: "Invite by email",
  self_signup_with_approval: "Self sign-up with approval",
};

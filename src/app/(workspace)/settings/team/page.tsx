import Link from "next/link";
import { reviewJoinRequest, revokeInvite, setMemberRole, setMemberStatus } from "@/lib/companies/actions";
import { requireWorkspace } from "@/lib/auth/session";
import { STAFF_ROLES, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { InviteForm, ReissueButton } from "@/components/settings/forms";
import { LaterPhase } from "@/components/shell/placeholder";
import { Button } from "@/components/ui/button";
import { appOrigin } from "@/lib/utils";

export default async function TeamPage() {
  const { membership } = await requireWorkspace();
  if (!can(membership.permissions, "manageUsers")) {
    return (
      <LaterPhase
        kicker="People"
        title="Team"
        body="Invites and approvals are for people with manage users."
      />
    );
  }

  const supabase = await createClient();
  const companyId = membership.company_id;
  const [members, invites, requests] = await Promise.all([
    supabase
      .from("company_members")
      .select("id, username, status, user_id, roles(key, name), profiles!company_members_profile_fkey(email)")
      .eq("company_id", companyId)
      .order("username"),
    supabase
      .from("invites")
      .select("id, email, username, status, expires_at, roles(name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("join_requests")
      .select("id, status, created_at, user_id, profiles!join_requests_profile_fkey(email)")
      .eq("company_id", companyId)
      .eq("status", "pending"),
  ]);

  const mode = membership.account_access_mode;
  const joinUrl = `${appOrigin()}/c/${membership.company_slug}/join`;

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber">People</p>
        <h1 className="mt-1 text-3xl font-bold">Team</h1>
        <p className="mt-2 text-sm text-muted">
          {mode === "invite"
            ? "This company is invite-only. Share a link; the person sets their own password and is active immediately."
            : "This company approves sign-ups. New invites are closed until you switch the mode in settings."}
        </p>
        <Link href="/settings" className="mt-2 inline-block text-sm text-amber">
          Company settings
        </Link>
      </header>

      {mode === "invite" ? (
        <section className="rounded-xl border border-line bg-raised p-5">
          <h2 className="font-semibold">Invite someone</h2>
          <div className="mt-3">
            <InviteForm companyId={companyId} />
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-line bg-raised p-5">
          <h2 className="font-semibold">Join link</h2>
          <p className="mt-2 break-all font-mono text-sm">{joinUrl}</p>
          <p className="mt-2 text-sm text-muted">Pending people get guest access until you assign a role.</p>
        </section>
      )}

      <section className="rounded-xl border border-line bg-raised p-5">
        <h2 className="font-semibold">Members</h2>
        {members.error ? <p className="mt-2 text-sm text-danger">{members.error.message}</p> : null}
        <ul className="mt-3 grid gap-3">
          {(members.data ?? []).map((member) => {
            const role = first(member.roles);
            const profile = first(member.profiles);
            return (
              <li key={member.id} className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-semibold">{member.username}</p>
                  <p className="text-sm text-muted">
                    {profile?.email ?? "No email"} · {role?.name ?? "Role"} · {member.status}
                  </p>
                </div>
                {member.status !== "pending" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={setMemberRole} className="flex gap-2">
                      <input type="hidden" name="membership_id" value={member.id} />
                      <select name="role_key" defaultValue={role?.key ?? "sales"} className="h-9 rounded-md border border-line bg-sunken px-2 text-sm">
                        {STAFF_ROLES.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm" variant="quiet">
                        Set role
                      </Button>
                    </form>
                    <form action={setMemberStatus}>
                      <input type="hidden" name="membership_id" value={member.id} />
                      <input type="hidden" name="status" value={member.status === "disabled" ? "active" : "disabled"} />
                      <Button type="submit" size="sm" variant="ghost">
                        {member.status === "disabled" ? "Enable" : "Disable"}
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {mode === "self_signup_with_approval" ? (
        <section className="rounded-xl border border-line bg-raised p-5">
          <h2 className="font-semibold">Pending sign-ups</h2>
          {(requests.data ?? []).length === 0 ? <p className="mt-2 text-sm text-muted">No one is waiting.</p> : null}
          <ul className="mt-3 grid gap-3">
            {(requests.data ?? []).map((request) => {
              const profile = first(request.profiles);
              return (
                <li key={request.id} className="rounded-md border border-line p-3">
                  <p className="font-semibold">{profile?.email ?? request.user_id}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <form action={reviewJoinRequest} className="flex gap-2">
                      <input type="hidden" name="request_id" value={request.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <select name="role_key" defaultValue="sales" className="h-9 rounded-md border border-line bg-sunken px-2 text-sm">
                        {STAFF_ROLES.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm">
                        Approve
                      </Button>
                    </form>
                    <form action={reviewJoinRequest}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <input type="hidden" name="decision" value="deny" />
                      <input type="hidden" name="role_key" value="" />
                      <Button type="submit" size="sm" variant="danger">
                        Deny
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-line bg-raised p-5">
        <h2 className="font-semibold">Invites</h2>
        {(invites.data ?? []).length === 0 ? <p className="mt-2 text-sm text-muted">No invites yet.</p> : null}
        <ul className="mt-3 grid gap-3">
          {(invites.data ?? []).map((invite) => {
            const role = first(invite.roles);
            return (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3">
                <div>
                  <p className="font-semibold">{invite.email}</p>
                  <p className="text-sm text-muted">
                    {invite.username} · {role?.name ?? "Role"} · {invite.status}
                  </p>
                </div>
                {invite.status === "pending" ? (
                  <div className="flex items-start gap-2">
                    <ReissueButton inviteId={invite.id} />
                    <form action={revokeInvite}>
                      <input type="hidden" name="invite_id" value={invite.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        Revoke
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function first<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

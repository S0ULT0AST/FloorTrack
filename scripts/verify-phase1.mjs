/**
 * Proves the local owner → company → manager → staff flow and that RLS
 * hides one company from another. Requires `supabase start` and the keys
 * from `supabase status -o env` in the environment.
 */
import { execSync } from "node:child_process";

function envFromStatus() {
  const raw = execSync("supabase status -o env", { encoding: "utf8" });
  const env = {};
  for (const line of raw.split("\n")) {
    const index = line.indexOf("=");
    if (index === -1) continue;
    env[line.slice(0, index)] = line.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const status = envFromStatus();
const api = status.API_URL;
const anon = status.ANON_KEY || status.PUBLISHABLE_KEY;
const service = status.SERVICE_ROLE_KEY || status.SECRET_KEY;

if (!api || !anon || !service) {
  throw new Error("supabase status did not return API URL and keys");
}

const password = "floortrack-test-pass";

async function signIn(email) {
  const response = await fetch(`${api}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`sign in ${email}: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function rpc(token, fn, args) {
  const response = await fetch(`${api}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: anon,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${fn} ${response.status}: ${text}`);
  }
  return json;
}

async function rest(token, path, init = {}) {
  const response = await fetch(`${api}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anon,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text, json: text ? JSON.parse(text) : null };
}

async function ensureUser(email) {
  const headers = {
    apikey: service,
    authorization: `Bearer ${service}`,
    "content-type": "application/json",
  };
  const created = await fetch(`${api}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (created.ok) return created.json();
  const listed = await fetch(`${api}/auth/v1/admin/users?per_page=200`, { headers });
  const body = await listed.json();
  const existing = (body.users ?? []).find((user) => user.email === email);
  if (!existing) throw new Error(`could not create ${email}: ${await created.text()}`);
  await fetch(`${api}/auth/v1/admin/users/${existing.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ password, email_confirm: true }),
  });
  return existing;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`ok ${message}`);
}

const owner = await ensureUser("owner@floortrack.test");
const promote = await fetch(`${api}/rest/v1/platform_admins`, {
  method: "POST",
  headers: {
    apikey: service,
    authorization: `Bearer ${service}`,
    "content-type": "application/json",
    prefer: "resolution=merge-duplicates",
  },
  body: JSON.stringify({ user_id: owner.id }),
});
if (!promote.ok && promote.status !== 409) {
  const detail = await promote.text();
  if (!detail.includes("duplicate")) {
    throw new Error(`promote owner failed ${promote.status}: ${detail}`);
  }
}

const ownerToken = await signIn("owner@floortrack.test");
const alpha = await rpc(ownerToken, "create_company", {
  name: "Alpha Appliances",
  slug: `alpha-${Date.now().toString(36)}`,
  timezone: "America/Chicago",
  account_access_mode: "invite",
  sites: [
    { name: "Warehouse", type: "warehouse" },
    { name: "Retail", type: "retail" },
  ],
  manager_email: "alpha.manager@floortrack.test",
  manager_username: "alpha_mgr",
  manager_role: "manager",
});
assert(alpha.invite_token, "owner created alpha and received an invite token");

const beta = await rpc(ownerToken, "create_company", {
  name: "Beta Appliances",
  slug: `beta-${Date.now().toString(36)}`,
  timezone: "America/Chicago",
  account_access_mode: "self_signup_with_approval",
  sites: [{ name: "Beta Warehouse", type: "warehouse" }],
  manager_email: "beta.manager@floortrack.test",
  manager_username: "beta_mgr",
  manager_role: "manager",
});

await ensureUser("alpha.manager@floortrack.test");
const managerToken = await signIn("alpha.manager@floortrack.test");
await rpc(managerToken, "accept_invite", { token: alpha.invite_token });
const context = await rpc(managerToken, "my_context", {});
const membership = context.memberships.find((item) => item.company_id === alpha.company_id);
assert(membership?.role_key === "manager", "manager accepted the invite");
assert(membership.permissions.editLayout === true, "manager can edit layout");
assert(membership.permissions.manageUsers === true, "manager can manage users");
assert(membership.permissions.manageLocations === true, "manager can manage locations");
assert(membership.permissions.viewAudit !== true, "manager does not get audit by default");
assert(membership.stores.length === 2, "manager sees both sites");

const staffInvite = await rpc(managerToken, "create_invite", {
  company_id: alpha.company_id,
  email: "alpha.staff@floortrack.test",
  role_key: "sales",
  username: "alpha_sales",
});
await ensureUser("alpha.staff@floortrack.test");
const staffToken = await signIn("alpha.staff@floortrack.test");
await rpc(staffToken, "accept_invite", { token: staffInvite.invite_token });

const staffStores = await rest(staffToken, `stores?company_id=eq.${alpha.company_id}&select=id,name,type`);
assert(staffStores.ok && staffStores.json.length === 2, "staff can read their company sites");

const leaked = await rest(staffToken, `stores?company_id=eq.${beta.company_id}&select=id`);
assert(leaked.ok && leaked.json.length === 0, "staff cannot read the other company's sites");

const leakedItems = await rest(staffToken, `items?company_id=eq.${beta.company_id}&select=id`);
assert(leakedItems.ok && leakedItems.json.length === 0, "staff cannot read the other company's items");

const insertOther = await rest(staffToken, "stores", {
  method: "POST",
  headers: { prefer: "return=representation" },
  body: JSON.stringify({ company_id: beta.company_id, name: "Stolen", type: "retail" }),
});
assert(!insertOther.ok, "staff cannot insert a site into the other company");

const betaRow = await rest(ownerToken, `companies?id=eq.${beta.company_id}&select=slug`);
assert(betaRow.ok && betaRow.json[0]?.slug, "owner can read the company slug");
beta.slug = betaRow.json[0].slug;

await ensureUser("beta.manager@floortrack.test");
const betaManagerToken = await signIn("beta.manager@floortrack.test");
await rpc(betaManagerToken, "accept_invite", { token: beta.invite_token });

await ensureUser("beta.joiner@floortrack.test");
const joinerToken = await signIn("beta.joiner@floortrack.test");
await rpc(joinerToken, "request_to_join", { slug: beta.slug, username: "beta_join" });
const pending = await rest(
  betaManagerToken,
  `join_requests?company_id=eq.${beta.company_id}&status=eq.pending&select=id`,
);
assert(pending.ok && pending.json.length === 1, "manager sees the pending join request");
await rpc(betaManagerToken, "review_join_request", {
  request_id: pending.json[0].id,
  decision: "approve",
  role_key: "warehouse",
});
const joinerStores = await rest(joinerToken, `stores?company_id=eq.${beta.company_id}&select=id`);
assert(joinerStores.ok && joinerStores.json.length === 1, "approved joiner can read their company");
const joinerLeak = await rest(joinerToken, `stores?company_id=eq.${alpha.company_id}&select=id`);
assert(joinerLeak.ok && joinerLeak.json.length === 0, "approved joiner cannot read the other company");

const closed = await rpc(betaManagerToken, "create_invite", {
  company_id: beta.company_id,
  email: "nobody@floortrack.test",
  role_key: "sales",
  username: "nobody_user",
}).then(
  () => false,
  (error) => error.message.includes("approves sign-ups"),
);
assert(closed, "approval-mode company rejects new invites");

console.log("phase 1 flow verified");

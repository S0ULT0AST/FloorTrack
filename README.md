# FloorTrack

FloorTrack is the floor-inventory app for an appliance store: companies, warehouse and retail sites, and the people who work them. This repository is phase 1 of a rebuild. It replaces the Google Apps Script app's anonymous database and client-side password hashing with Supabase Auth and row-level security. Inventory, the floor map, transfers, sales, and notification email come in later phases. The notification master switch exists and stays off.

## What phase 1 includes

- Email sign-in, sign-up, password reset, and change email or password through Supabase Auth. Passwords are never hashed in the browser.
- A platform-owner dashboard to create a company, its first sites, and an invite link for the first manager or admin.
- Company settings for managers: one account-access mode (`invite` or `self_signup_with_approval`), sites, invites, and approving or denying sign-ups.
- An app shell in the dark FloorTrack theme, with a light theme, phone, tablet, and desktop layouts, and a PWA manifest plus service worker.
- The inventory, transfer, and audit tables, so later phases do not have to restate tenancy. There is no inventory editor yet.

Companies cannot see each other's rows. A sold serial can be reused; two unsold serials in the same company cannot.

## Local setup

You need Node.js 22+, Docker, and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
npm install
supabase start
supabase status -o env
```

Copy `.env.example` to `.env.local` and fill it from that status output:

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` (local default `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY`, or `ANON_KEY` if you set `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead |
| `SUPABASE_SECRET_KEY` | `SECRET_KEY`, or `SERVICE_ROLE_KEY` in `SUPABASE_SERVICE_ROLE_KEY` |
| `NEXT_PUBLIC_APP_URL` | `http://127.0.0.1:43123` locally |
| `PLATFORM_OWNER_EMAILS` | Comma-separated emails that become platform owners when they sign in |

The secret key is server-only. Do not prefix it with `NEXT_PUBLIC_`.

```bash
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). Sign up with an email listed in `PLATFORM_OWNER_EMAILS`, then create a company and copy the manager link. Local auth mail (password reset, email change) is captured by Mailpit at [http://127.0.0.1:54324](http://127.0.0.1:54324). Invite and join links are shown in the app and are not emailed. Studio is at [http://127.0.0.1:54323](http://127.0.0.1:54323).

Local email confirmation is off in `supabase/config.toml` so the owner → manager → staff flow works without a mailbox. Turn `auth.email.enable_confirmations` on for a hosted project.

Reset the database after pulling schema changes:

```bash
npm run db:reset
```

## Checks

```bash
npm run typecheck
npm run lint
npm run test:db
npm run test:flow
npm run build
```

`test:db` is pgTAP. It creates two companies and checks that a member of one cannot read or write the other. `test:flow` signs in through the local Auth API and walks owner → manager invite → staff invite → a second company on the approval path.

## Hosted Supabase

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. In Authentication → URL configuration, set the site URL to the Vercel URL and add `https://<your-domain>/auth/callback` to the redirect allow list.
3. Set the minimum password length to 8.
4. Apply the migrations: `supabase link --project-ref <ref>` then `supabase db push`.
5. Copy the project URL, publishable key, and secret key into the host's environment. Put the same names as `.env.example` on Vercel.
6. Set `PLATFORM_OWNER_EMAILS` to the owner's email before that person signs up.

The app is the system of record. There is no Google Sheet sync.

## Vercel

Import the repo. Framework preset is Next.js. Set the environment variables above for Production and Preview. `NEXT_PUBLIC_APP_URL` must be the deployment URL so reset links and invite links point at the right host. Deploy. No extra services are required for phase 1.

## Installable app

`src/app/manifest.ts`, `public/sw.js`, and the icons in `public/icons` make the site installable on phones, tablets, and desktop browsers. The service worker caches the shell and last page for a dropped connection. Writes stay online-first. `src/lib/native/adapter.ts` is the seam a later Capacitor wrap can replace for camera and file picking. This phase does not ship a store binary.

## Decisions carried in from the plan

- Sites are `warehouse` or `retail`.
- Staff can see every site in their company. A home store is optional.
- Serials are unique among unsold items, company-wide.
- No sheet sync.
- Company timezone, with America/Chicago as the create-company default.
- Price is its own column. Notes are a separate timestamped table.
- New companies give Manager `editLayout`, `manageUsers`, and `manageLocations`. They do not get `viewAudit`, `manageRoles`, or `deleteLocations`.
- Login is email. Username is unique per company.

## Deviations

- The legacy Admin tab is gated by `viewAudit`. Managers who can manage users but cannot view the audit log get a Settings item so they can invite people and edit sites.
- Invites are links shown in the app. Phase 1 does not send them. Supabase Auth still sends its own reset and email-change messages.
- Platform owner is a `platform_admins` row, not a flag on the auth user, and it is never read from editable user metadata.
- Account access is stored as `invite` or `self_signup_with_approval`.
- The founding manager is invited even when the company will approve everyone else. After that, the chosen mode is exclusive.
- Map, inventory, transfers, repairs, sold, and admin screens are shells. The tables behind them are real.
- Local analytics (Logflare) is off in `supabase/config.toml` to keep the Docker stack smaller. Realtime, Storage, Auth, and Studio stay on.

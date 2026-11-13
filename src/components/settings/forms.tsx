"use client";

import { useActionState } from "react";
import { createInvite, createSite, reissueInvite, updateCompanySettings } from "@/lib/companies/actions";
import { STAFF_ROLES } from "@/lib/permissions";
import { timezoneOptions } from "@/lib/timezones";
import { Button } from "@/components/ui/button";
import { Field, FormNote, SelectInput, TextInput } from "@/components/ui/field";

export function CompanySettingsForm({
  companyId,
  name,
  timezone,
  mode,
}: {
  companyId: string;
  name: string;
  timezone: string;
  mode: string;
}) {
  const [state, action, pending] = useActionState(updateCompanySettings, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="company_id" value={companyId} />
      <Field label="Company name">
        <TextInput name="name" defaultValue={name} required />
      </Field>
      <Field label="Timezone" hint="Charlie Wilson's uses America/Chicago. Dates in later phases follow this.">
        <SelectInput name="timezone" defaultValue={timezone}>
          {timezoneOptions(timezone).map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </SelectInput>
      </Field>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">How people join</legend>
        <label className="flex gap-2 text-sm">
          <input type="radio" name="account_access_mode" value="invite" defaultChecked={mode === "invite"} />
          Invite by email. Self sign-up stays closed.
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="radio"
            name="account_access_mode"
            value="self_signup_with_approval"
            defaultChecked={mode === "self_signup_with_approval"}
          />
          People sign up and a manager approves them. New invites stay closed.
        </label>
      </fieldset>
      <FormNote error={state?.error} ok={state?.ok} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save company settings"}
      </Button>
    </form>
  );
}

export function AddSiteForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(createSite, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="company_id" value={companyId} />
      <Field label="Site name">
        <TextInput name="name" required />
      </Field>
      <Field label="Type">
        <SelectInput name="site_type" defaultValue="retail">
          <option value="warehouse">Warehouse</option>
          <option value="retail">Retail</option>
        </SelectInput>
      </Field>
      <Field label="Timezone override" hint="Blank uses the company timezone.">
        <TextInput name="timezone" placeholder="America/Chicago" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} variant="quiet">
          {pending ? "Adding…" : "Add site"}
        </Button>
      </div>
      <div className="sm:col-span-4">
        <FormNote error={state?.error} ok={state?.ok} />
      </div>
    </form>
  );
}

export function InviteForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(createInvite, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="company_id" value={companyId} />
      <Field label="Email">
        <TextInput name="email" type="email" required />
      </Field>
      <Field label="Username">
        <TextInput name="username" required />
      </Field>
      <Field label="Role">
        <SelectInput name="role_key" defaultValue="sales">
          {STAFF_ROLES.map((role) => (
            <option key={role.key} value={role.key}>
              {role.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <FormNote error={state?.error} ok={state?.ok} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating link…" : "Create invite link"}
      </Button>
      <p className="text-xs text-muted">
        FloorTrack does not send this email. Copy the link. Sale and transfer notifications stay off.
      </p>
    </form>
  );
}

export function ReissueButton({ inviteId }: { inviteId: string }) {
  const [state, action, pending] = useActionState(reissueInvite, null);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="invite_id" value={inviteId} />
      <Button type="submit" size="sm" variant="quiet" disabled={pending}>
        {pending ? "Refreshing…" : "New link"}
      </Button>
      <FormNote error={state?.error} ok={state?.ok} />
    </form>
  );
}

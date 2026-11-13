"use client";

import { useActionState, useState } from "react";
import { createCompany } from "@/lib/companies/actions";
import { timezoneOptions } from "@/lib/timezones";
import { Button } from "@/components/ui/button";
import { Field, FormNote, SelectInput, TextInput } from "@/components/ui/field";

type SiteRow = { name: string; type: "warehouse" | "retail"; timezone: string };

const starter: SiteRow[] = [
  { name: "Warehouse", type: "warehouse", timezone: "" },
  { name: "Retail store", type: "retail", timezone: "" },
];

export function NewCompanyForm() {
  const [state, action, pending] = useActionState(createCompany, null);
  const [sites, setSites] = useState<SiteRow[]>(starter);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");

  function slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
  }

  return (
    <form action={action} className="grid gap-4">
      <Field label="Company name" hint="Example: Charlie Wilson's Appliance & TV">
        <TextInput
          name="name"
          required
          onChange={(event) => {
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
        />
      </Field>
      <Field label="Slug" hint="Used in the join link. Lowercase, numbers, hyphens.">
        <TextInput
          name="slug"
          required
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(slugify(event.target.value));
          }}
        />
      </Field>
      <Field label="Timezone">
        <SelectInput name="timezone" defaultValue="America/Chicago">
          {timezoneOptions("America/Chicago").map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </SelectInput>
      </Field>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">Account access</legend>
        <label className="flex gap-2 text-sm">
          <input type="radio" name="account_access_mode" value="invite" defaultChecked />
          Invite by email
        </label>
        <label className="flex gap-2 text-sm">
          <input type="radio" name="account_access_mode" value="self_signup_with_approval" />
          Self sign-up with approval
        </label>
      </fieldset>
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">First sites</h2>
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => setSites((rows) => [...rows, { name: "", type: "retail", timezone: "" }])}
          >
            Add site
          </Button>
        </div>
        {sites.map((site, index) => (
          <div key={index} className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-3">
            <Field label="Name">
              <TextInput
                name="site_name"
                value={site.name}
                onChange={(event) =>
                  setSites((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, name: event.target.value } : row)))
                }
              />
            </Field>
            <Field label="Type">
              <SelectInput
                name="site_type"
                value={site.type}
                onChange={(event) =>
                  setSites((rows) =>
                    rows.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, type: event.target.value as SiteRow["type"] } : row,
                    ),
                  )
                }
              >
                <option value="warehouse">Warehouse</option>
                <option value="retail">Retail</option>
              </SelectInput>
            </Field>
            <Field label="Timezone override">
              <TextInput
                name="site_timezone"
                value={site.timezone}
                placeholder="Optional"
                onChange={(event) =>
                  setSites((rows) =>
                    rows.map((row, rowIndex) => (rowIndex === index ? { ...row, timezone: event.target.value } : row)),
                  )
                }
              />
            </Field>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First manager email">
          <TextInput name="manager_email" type="email" required />
        </Field>
        <Field label="First manager username">
          <TextInput name="manager_username" required />
        </Field>
        <Field label="Role">
          <SelectInput name="manager_role" defaultValue="manager">
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </SelectInput>
        </Field>
      </div>
      <p className="text-xs text-muted">
        New companies give Manager edit layout, manage users, and manage locations. The founding person is invited even if later staff must be approved. No email is sent — you get a link to hand them.
      </p>
      <FormNote error={state?.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create company"}
      </Button>
    </form>
  );
}

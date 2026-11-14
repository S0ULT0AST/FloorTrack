"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  changeEmail,
  changePassword,
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
} from "@/lib/auth/actions";
import { setHomeStore, setMyUsername } from "@/lib/companies/actions";
import { Button } from "@/components/ui/button";
import { Field, FormNote, SelectInput, TextInput } from "@/components/ui/field";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email">
        <TextInput name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Password">
        <TextInput name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormNote error={state?.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <Link href="/forgot-password" className="text-sm text-amber">
        Forgot password
      </Link>
    </form>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signUp, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Name" hint="Shown on your account. Your company username is separate.">
        <TextInput name="display_name" autoComplete="name" />
      </Field>
      <Field label="Email">
        <TextInput name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" hint="At least 8 characters. FloorTrack never stores this in the browser.">
        <TextInput name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <FormNote error={state?.error} ok={state?.ok} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="grid gap-4">
      <Field label="Email">
        <TextInput name="email" type="email" autoComplete="email" required />
      </Field>
      <FormNote error={state?.error} ok={state?.ok} />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <form action={action} className="grid gap-4">
      <Field label="New password">
        <TextInput name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirm password">
        <TextInput name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <FormNote error={state?.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}

export function PasswordChangeForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="grid gap-3">
      <Field label="Current password">
        <TextInput name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password">
        <TextInput name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirm new password">
        <TextInput name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <FormNote error={state?.error} ok={state?.ok} />
      <Button type="submit" disabled={pending} variant="quiet">
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}

export function EmailChangeForm() {
  const [state, action, pending] = useActionState(changeEmail, null);
  return (
    <form action={action} className="grid gap-3">
      <Field label="New email">
        <TextInput name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Current password">
        <TextInput name="current" type="password" autoComplete="current-password" required />
      </Field>
      <FormNote error={state?.error} ok={state?.ok} />
      <Button type="submit" disabled={pending} variant="quiet">
        {pending ? "Sending…" : "Change email"}
      </Button>
    </form>
  );
}

export function UsernameForm({ companyId, username }: { companyId: string; username: string }) {
  const [state, action, pending] = useActionState(setMyUsername, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="company_id" value={companyId} />
      <Field label="Username" hint="Unique inside this company. This is the name on the floor.">
        <TextInput name="username" defaultValue={username} required />
      </Field>
      <FormNote error={state?.error} ok={state?.ok} />
      <Button type="submit" disabled={pending} variant="quiet">
        {pending ? "Saving…" : "Save username"}
      </Button>
    </form>
  );
}

export function HomeStoreForm({
  companyId,
  stores,
  current,
}: {
  companyId: string;
  stores: { id: string; name: string; type: string }[];
  current: string | null;
}) {
  return (
    <form action={setHomeStore} className="grid gap-3">
      <input type="hidden" name="company_id" value={companyId} />
      <Field label="Home store" hint="Optional. The site switcher opens here first. You can still see every site.">
        <SelectInput name="store_id" defaultValue={current ?? ""}>
          <option value="">No home store</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name} ({store.type})
            </option>
          ))}
        </SelectInput>
      </Field>
      <Button type="submit" variant="quiet">
        Save home store
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { requestToJoin } from "@/lib/companies/actions";
import { Button } from "@/components/ui/button";
import { Field, FormNote, TextInput } from "@/components/ui/field";

export function JoinForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(requestToJoin, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="slug" value={slug} />
      <Field label="Email">
        <TextInput name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" hint="At least 8 characters. Skip this if you are already signed in.">
        <TextInput name="password" type="password" autoComplete="new-password" minLength={8} />
      </Field>
      <Field label="Username" hint="What coworkers see. Unique in this company.">
        <TextInput name="username" required />
      </Field>
      <FormNote error={state?.error} ok={state?.ok} />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending request…" : "Request access"}
      </Button>
    </form>
  );
}

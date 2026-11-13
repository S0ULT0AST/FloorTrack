"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/lib/companies/actions";
import { Button } from "@/components/ui/button";
import { FormNote } from "@/components/ui/field";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(acceptInvite, null);
  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <FormNote error={state?.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Joining…" : "Accept invite"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { sendMagicLink } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(sendMagicLink, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Invio…" : "Inviami il link di accesso"}
      </Button>
    </form>
  );
}

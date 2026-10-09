"use client";

import { useActionState } from "react";
import { sendSignInLink, type AuthFormState } from "@/app/(auth)/actions";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthFormState = { error: null, fields: {} };

export function MagicLinkForm({ next }: { next: string | undefined }) {
  const [state, formAction, pending] = useActionState(
    sendSignInLink,
    initialState,
  );

  // The key re-mounts the input with what the user typed after an error (see SignUpForm).
  return (
    <form action={formAction} className="grid gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          key={state.fields.email}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.fields.email}
          required
        />
      </div>
      {state.error && <FormError>{state.error}</FormError>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending..." : "Email me a link"}
      </Button>
    </form>
  );
}

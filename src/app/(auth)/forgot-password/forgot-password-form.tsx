"use client";

import { useActionState } from "react";
import {
  sendPasswordReset,
  type PasswordResetState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PasswordResetState = {
  error: null,
  fields: {},
  sent: false,
};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    sendPasswordReset,
    initialState,
  );

  if (state.sent) {
    return (
      <p role="status" className="text-sm">
        If {state.fields.email} has an account, we&apos;ve sent it a link to
        choose a new password. It works once, for an hour, on any device.
      </p>
    );
  }

  // The key re-mounts the input with what the user typed after an error (see SignUpForm).
  return (
    <form action={formAction} className="grid gap-4">
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
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending..." : "Email me a link"}
      </Button>
    </form>
  );
}

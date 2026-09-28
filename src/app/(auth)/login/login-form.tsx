"use client";

import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthFormState = { error: null, fields: {} };

export function LoginForm({ next }: { next: string | undefined }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  // The key re-mounts the email input with what the user typed after a failed attempt (see
  // SignUpForm for why).
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
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { signUp, type AuthFormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthFormState = { error: null, fields: {} };

export function SignUpForm({ next }: { next: string | undefined }) {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  // React resets the form after each submit. The inputs below get back what the user typed
  // from the action's result; the key re-mounts them, because Base UI inputs don't accept a
  // new defaultValue after their first render.
  return (
    <form action={formAction} className="grid gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid gap-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          key={state.fields.fullName}
          id="fullName"
          name="fullName"
          autoComplete="name"
          defaultValue={state.fields.fullName}
          maxLength={100}
          required
        />
      </div>
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
          autoComplete="new-password"
          aria-describedby="password-hint"
          minLength={8}
          required
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          At least 8 characters, with letters and numbers.
        </p>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}

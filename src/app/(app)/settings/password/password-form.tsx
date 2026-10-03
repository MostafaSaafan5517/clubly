"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  changePassword,
  type PasswordFormState,
} from "@/app/(app)/settings/password/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PasswordFormState = { error: null, changed: false };

export function PasswordForm({
  askForCurrent,
  continueHref,
}: {
  askForCurrent: boolean;
  continueHref: string;
}) {
  const [state, formAction, pending] = useActionState(
    changePassword,
    initialState,
  );

  if (state.changed) {
    return (
      <div className="grid justify-items-start gap-4">
        <p role="status" className="text-sm">
          Your password is changed. Any other device signed in to your account
          is signed out within the hour.
        </p>
        <Link href={continueHref} className={buttonVariants()}>
          Continue
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      {askForCurrent && (
        <div className="grid gap-2">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-describedby="password-rules"
          required
        />
        <p id="password-rules" className="text-sm text-muted-foreground">
          At least 8 characters, with letters and numbers.
        </p>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving..." : "Save password"}
      </Button>
    </form>
  );
}

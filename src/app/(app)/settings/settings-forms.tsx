"use client";

import { useActionState } from "react";
import {
  deleteAccount,
  type SettingsFormState,
  updateName,
} from "@/app/(app)/settings/actions";
import { FormDone } from "@/components/form-done";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SettingsFormState = { error: null, saved: false };

export function NameForm({ currentName }: { currentName: string }) {
  const [state, formAction, pending] = useActionState(updateName, initialState);

  // The key re-mounts the input when the saved name changes.
  return (
    <form action={formAction} className="grid gap-2">
      <Label htmlFor="fullName">Name</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          key={currentName}
          id="fullName"
          name="fullName"
          autoComplete="name"
          defaultValue={currentName}
          maxLength={100}
          required
          className="min-w-0 flex-1 basis-48"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
      {state.error ? (
        <FormError>{state.error}</FormError>
      ) : (
        state.saved && <FormDone>Saved.</FormDone>
      )}
    </form>
  );
}

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(
    deleteAccount,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="confirmEmail">
          Type <span className="font-mono break-all">{email}</span> to confirm
        </Label>
        <Input
          id="confirmEmail"
          name="confirmEmail"
          type="email"
          autoComplete="off"
          required
        />
      </div>
      {state.error && <FormError>{state.error}</FormError>}
      <div>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Deleting..." : "Delete my account"}
        </Button>
      </div>
    </form>
  );
}

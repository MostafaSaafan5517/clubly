"use client";

import { useActionState, useId } from "react";
import type { RenameState } from "@/app/(app)/dashboard/b/[slug]/actions";
import { FormDone } from "@/components/form-done";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: RenameState = { error: null, saved: false };

/** A one-field form for renaming the business or a plan. */
export function RenameForm({
  action,
  label,
  currentName,
  maxLength,
}: {
  action: (previous: RenameState, formData: FormData) => Promise<RenameState>;
  label: string;
  currentName: string;
  maxLength: number;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const inputId = useId();

  // The key re-mounts the input when the saved name changes, so it shows the current one.
  return (
    <form action={formAction} className="grid gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          key={currentName}
          id={inputId}
          name="name"
          defaultValue={currentName}
          maxLength={maxLength}
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

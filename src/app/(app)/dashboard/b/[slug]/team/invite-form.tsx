"use client";

import { useActionState, useState } from "react";
import type { InviteFormState } from "@/app/(app)/dashboard/b/[slug]/team/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

const initialState: InviteFormState = { error: null, link: null, role: null };

const roleLabels = {
  admin: "Admin: plans, members, revenue, history and staff",
  staff: "Staff: sees the members",
} as const;

export function InviteForm({
  action,
  roles,
  lifetimeDays,
}: {
  action: (
    previous: InviteFormState,
    formData: FormData,
  ) => Promise<InviteFormState>;
  roles: readonly ("admin" | "staff")[];
  lifetimeDays: number;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(link);
    } catch {
      // Clipboard access can be refused (permissions, insecure origin); the link stays
      // selectable in the field.
      setCopied(null);
    }
  }

  return (
    <div className="grid gap-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-0 flex-1 gap-2">
          <Label htmlFor="invite-role">Role</Label>
          <NativeSelect
            id="invite-role"
            name="role"
            className="w-full"
            defaultValue="staff"
          >
            {roles.map((role) => (
              <NativeSelectOption key={role} value={role}>
                {roleLabels[role]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create invite link"}
        </Button>
      </form>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      {state.link && (
        <div className="grid gap-2 rounded-lg border p-4" role="status">
          <Label htmlFor="invite-link">
            Invite link for a new {state.role}
          </Label>
          <div className="flex gap-2">
            <Input
              id="invite-link"
              readOnly
              value={state.link}
              onFocus={(event) => event.currentTarget.select()}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => copy(state.link ?? "")}
            >
              {copied === state.link ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Send it to the person you&apos;re inviting. It works once, for{" "}
            {lifetimeDays} days. We don&apos;t keep a copy, so this is the only
            time you&apos;ll see it.
          </p>
        </div>
      )}
    </div>
  );
}

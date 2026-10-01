"use client";

import { useActionState } from "react";
import type { NewPlanFormState } from "@/app/(app)/dashboard/b/[slug]/plans/new/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

const initialState: NewPlanFormState = { error: null, fields: {} };

export function NewPlanForm({
  action,
}: {
  action: (
    previous: NewPlanFormState,
    formData: FormData,
  ) => Promise<NewPlanFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  // The keys re-mount inputs with what the user typed after an error (see SignUpForm).
  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Plan name</Label>
        <Input
          key={state.fields.name}
          id="name"
          name="name"
          placeholder="Monthly membership"
          defaultValue={state.fields.name}
          maxLength={60}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="price">Price (USD)</Label>
          <Input
            key={state.fields.price}
            id="price"
            name="price"
            type="number"
            inputMode="decimal"
            min="0.50"
            max="999999.99"
            step="0.01"
            placeholder="30.00"
            defaultValue={state.fields.price}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="billingInterval">Billed</Label>
          <NativeSelect
            key={state.fields.billingInterval}
            id="billingInterval"
            name="billingInterval"
            className="w-full"
            defaultValue={state.fields.billingInterval ?? "month"}
          >
            <NativeSelectOption value="month">Monthly</NativeSelectOption>
            <NativeSelectOption value="year">Yearly</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        The price can&apos;t change after the plan is created. To change it,
        archive the plan and create a new one; current members keep their price.
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating plan..." : "Create plan"}
      </Button>
    </form>
  );
}

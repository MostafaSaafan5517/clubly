"use client";

import { useActionState, useState } from "react";
import {
  createBusiness,
  type NewBusinessFormState,
} from "@/app/dashboard/new-business/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_SLUG_LENGTH,
  MIN_SLUG_LENGTH,
  SLUG_PATTERN,
  slugify,
} from "@/lib/slug";

const initialState: NewBusinessFormState = { error: null };

export function NewBusinessForm() {
  const [state, formAction, pending] = useActionState(
    createBusiness,
    initialState,
  );
  // Controlled, so what the user typed survives the form reset after a failed submit, and so
  // the web address can follow the name until the user edits it themselves.
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Business name</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(slugify(event.target.value));
          }}
          maxLength={100}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="slug">Web address</Label>
        <Input
          id="slug"
          name="slug"
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value);
            setSlugEdited(true);
          }}
          aria-describedby="slug-hint"
          pattern={SLUG_PATTERN}
          minLength={MIN_SLUG_LENGTH}
          maxLength={MAX_SLUG_LENGTH}
          required
        />
        <p id="slug-hint" className="text-xs text-muted-foreground">
          Used in the link to your public join page. Lowercase letters, numbers
          and dashes.
        </p>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating business..." : "Create business"}
      </Button>
    </form>
  );
}

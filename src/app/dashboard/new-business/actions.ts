"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { MAX_SLUG_LENGTH, MIN_SLUG_LENGTH, SLUG_PATTERN } from "@/lib/slug";
import { createServerActionClient } from "@/lib/supabase/server";

export type NewBusinessFormState = { error: string | null };

const newBusinessSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your business's name.")
    .max(100, "Keep the name under 100 characters."),
  slug: z
    .string()
    .trim()
    .min(
      MIN_SLUG_LENGTH,
      `Use at least ${MIN_SLUG_LENGTH} characters for the web address.`,
    )
    .max(
      MAX_SLUG_LENGTH,
      `Keep the web address under ${MAX_SLUG_LENGTH} characters.`,
    )
    .regex(
      new RegExp(`^${SLUG_PATTERN}$`),
      "Use lowercase letters, numbers and single dashes in the web address.",
    ),
});

// Postgres error codes returned by create_business.
const UNIQUE_VIOLATION = "23505";
const NOT_SIGNED_IN = "42501";

export async function createBusiness(
  _previous: NewBusinessFormState,
  formData: FormData,
): Promise<NewBusinessFormState> {
  const parsed = newBusinessSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null };
  }

  // The database function checks the signed-in user too, and makes them the owner in the same
  // transaction as the insert.
  const supabase = await createServerActionClient();
  const { error } = await supabase.rpc("create_business", {
    business_name: parsed.data.name,
    business_slug: parsed.data.slug,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: "That web address is taken. Try another one." };
    }
    if (error.code === NOT_SIGNED_IN) {
      redirect("/login?next=%2Fdashboard%2Fnew-business");
    }
    console.error("Creating a business failed", { code: error.code });
    return { error: "We couldn't create your business. Please try again." };
  }

  redirect("/dashboard");
}

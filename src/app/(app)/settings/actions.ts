"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { DEMO_READ_ONLY_MESSAGE, isDemoAccount } from "@/lib/demo";
import { errorMessage } from "@/lib/redact";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createServerActionClient } from "@/lib/supabase/server";

export type SettingsFormState = { error: string | null; saved: boolean };

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function requireSignedIn() {
  const supabase = await createServerActionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect(`/login?next=${encodeURIComponent("/settings")}`);
  return { supabase, claims: data.claims };
}

/** Changes the name staff and businesses see for this user. */
export async function updateName(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const { supabase, claims } = await requireSignedIn();
  if (isDemoAccount(claims)) {
    return { error: DEMO_READ_ONLY_MESSAGE, saved: false };
  }
  const fullName = formText(formData, "fullName");
  if (fullName.length < 1 || fullName.length > 100) {
    return { error: "Use 1 to 100 characters for your name.", saved: false };
  }

  // Through RLS: users change only their own profile, and only its name.
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", claims.sub);
  if (error) {
    console.error("Updating a name failed", { code: error.code });
    return {
      error: "We couldn't save your name. Please try again.",
      saved: false,
    };
  }

  refresh();
  return { error: null, saved: true };
}

/**
 * Deletes the signed-in user's account. Refused while they own a business (it would be left
 * without an owner) or hold a membership anywhere (businesses keep their members' billing
 * records); staff rows go with the account. The database refuses both cases too.
 */
export async function deleteAccount(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const { supabase, claims } = await requireSignedIn();
  if (isDemoAccount(claims)) {
    return { error: DEMO_READ_ONLY_MESSAGE, saved: false };
  }
  const email = claims.email;
  if (!email) throw new Error("The signed-in user has no email address.");
  if (
    formText(formData, "confirmEmail").toLowerCase() !== email.toLowerCase()
  ) {
    return {
      error: "Type your email address exactly as shown to confirm.",
      saved: false,
    };
  }

  const [owned, memberships] = await Promise.all([
    supabase
      .from("business_staff")
      .select("businesses (name)")
      .eq("user_id", claims.sub)
      .eq("role", "owner"),
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", claims.sub),
  ]);
  if (owned.error) throw new Error(owned.error.message);
  if (memberships.error) throw new Error(memberships.error.message);
  if (owned.data.length > 0) {
    const names = owned.data.map((row) => row.businesses.name).join(", ");
    return {
      error: `You own ${names}. A business can't be left without its owner, so your account stays while you own one.`,
      saved: false,
    };
  }
  if ((memberships.count ?? 0) > 0) {
    return {
      error:
        "You have memberships. Businesses keep their members' billing records, so an account with memberships can't be deleted.",
      saved: false,
    };
  }

  // Users can't delete themselves through Supabase Auth; the server does it once it has
  // checked who is asking.
  const { error } = await supabaseAdmin.auth.admin.deleteUser(claims.sub);
  if (error) {
    console.error("Deleting an account failed", {
      status: error.status,
      message: errorMessage(error),
    });
    return {
      error: "We couldn't delete your account. Please try again.",
      saved: false,
    };
  }

  // The account is gone; this clears the session cookies. Supabase already dropped the session
  // with the account, and the client doesn't count "no such session" as an error.
  const { error: signOutError } = await supabase.auth.signOut({
    scope: "local",
  });
  if (signOutError) {
    console.error("Signing out a deleted account failed", {
      code: signOutError.code,
      status: signOutError.status,
    });
  }
  redirect("/?account=deleted");
}

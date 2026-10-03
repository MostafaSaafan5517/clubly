"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { DEMO_READ_ONLY_MESSAGE, isDemoAccount } from "@/lib/demo";
import { cameFromEmailLink, newPasswordSchema } from "@/lib/password";
import { supabaseConfig } from "@/lib/supabase/config";
import { createServerActionClient } from "@/lib/supabase/server";

export type PasswordFormState = { error: string | null; changed: boolean };

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Checks the password with a separate client that keeps no session, so this browser's sign-in
 * isn't touched. Returns what to tell the user, or null when the password is right.
 */
async function checkCurrentPassword(email: string, password: string) {
  const checker = createClient(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await checker.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "invalid_credentials") {
      return "Your current password is wrong.";
    }
    console.error("Checking the current password failed", {
      code: error.code,
      status: error.status,
    });
    return "We couldn't check your current password. Please try again.";
  }
  // The check opened a session of its own; close it.
  const { error: signOutError } = await checker.auth.signOut({
    scope: "local",
  });
  if (signOutError) {
    console.error("Closing the password check's session failed", {
      code: signOutError.code,
      status: signOutError.status,
    });
  }
  return null;
}

export async function changePassword(
  _previous: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const supabase = await createServerActionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) {
    redirect(`/login?next=${encodeURIComponent("/settings/password")}`);
  }
  if (isDemoAccount(data.claims)) {
    return { error: DEMO_READ_ONLY_MESSAGE, changed: false };
  }

  const parsed = newPasswordSchema.safeParse(formText(formData, "password"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, changed: false };
  }

  // Right after a reset (or sign-in) link, the user has just proved they own the email address
  // and may not know the old password; otherwise a session alone isn't enough.
  if (!cameFromEmailLink(data.claims)) {
    const currentPassword = formText(formData, "currentPassword");
    if (!currentPassword) {
      return { error: "Enter your current password.", changed: false };
    }
    const email = data.claims.email;
    if (!email) throw new Error("The signed-in user has no email address.");
    const problem = await checkCurrentPassword(email, currentPassword);
    if (problem) return { error: problem, changed: false };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    if (error.code === "same_password") {
      return {
        error: "That's your current password. Choose a new one.",
        changed: false,
      };
    }
    if (error.code === "weak_password") {
      return {
        error:
          "Choose a stronger password: at least 8 characters, with letters and numbers.",
        changed: false,
      };
    }
    console.error("Changing a password failed", {
      code: error.code,
      status: error.status,
    });
    return {
      error: "We couldn't change your password. Please try again.",
      changed: false,
    };
  }

  // Supabase ends every other session of this user (another device, or whoever knew the old
  // password) when the password changes; this one stays signed in.
  return { error: null, changed: true };
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appConfig } from "@/config/app";
import { SIGNED_IN_HOME } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createServerActionClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error: string | null;
  // Echoed back so the form keeps what the user typed after an error (never the password).
  fields: { fullName?: string; email?: string };
};

const emailField = z.email("Enter a valid email address.");

const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(100, "Keep your name under 100 characters."),
  email: emailField,
  // Mirrors the password rules in supabase/config.toml, so users see the reason right away.
  password: z
    .string()
    .regex(
      /^(?=.*[A-Za-z])(?=.*\d).{8,}$/,
      "Use at least 8 characters, with letters and numbers.",
    ),
});

const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password."),
});

function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Where an email link should bring the user back to: the page that sent them to sign in (the
 * form's "next" field), on this site. Supabase passes it into the email, and /auth/confirm
 * checks it again before redirecting.
 */
async function emailRedirectTo(formData: FormData) {
  const origin = (await headers()).get("origin");
  if (!origin) {
    throw new Error("Server Action request without an Origin header.");
  }
  return new URL(
    safeRedirectPath(formText(formData, "next"), SIGNED_IN_HOME),
    origin,
  ).toString();
}

export async function signUp(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fields = {
    fullName: formText(formData, "fullName"),
    email: formText(formData, "email"),
  };
  const parsed = signUpSchema.safeParse({
    ...fields,
    password: formText(formData, "password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, fields };
  }

  const supabase = await createServerActionClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Read by the database trigger that creates the user's profile.
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: await emailRedirectTo(formData),
    },
  });

  if (error) {
    // Only where sign-ups are confirmed at once (no email): Supabase then says so outright, so
    // there's nothing left to hide.
    if (error.code === "user_already_exists") {
      return {
        error: "That email already has an account. Sign in instead.",
        fields,
      };
    }
    if (error.code === "weak_password") {
      return {
        error:
          "Choose a stronger password: at least 8 characters, with letters and numbers.",
        fields,
      };
    }
    console.error("Sign-up failed", { code: error.code, status: error.status });
    return {
      error: "We couldn't create your account. Please try again.",
      fields,
    };
  }

  // Where sign-ups are confirmed at once, the new user is already signed in.
  if (data.session) {
    redirect(safeRedirectPath(formText(formData, "next"), SIGNED_IN_HOME));
  }
  // Otherwise Supabase answers the same way for an address that already has an account, so this
  // page never reveals whether someone is registered.
  redirect("/check-email");
}

export async function signIn(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fields = { email: formText(formData, "email") };
  const parsed = signInSchema.safeParse({
    ...fields,
    password: formText(formData, "password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, fields };
  }

  const supabase = await createServerActionClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "invalid_credentials") {
      return { error: "Wrong email or password.", fields };
    }
    if (error.code === "email_not_confirmed") {
      return {
        error: "Confirm your email first: open the link we sent you.",
        fields,
      };
    }
    console.error("Sign-in failed", { code: error.code, status: error.status });
    return { error: "We couldn't sign you in. Please try again.", fields };
  }

  redirect(safeRedirectPath(formText(formData, "next"), SIGNED_IN_HOME));
}

export async function sendSignInLink(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fields = { email: formText(formData, "email") };
  if (!appConfig.authEmails) {
    return { error: "Email sign-in links aren't available here.", fields };
  }
  const parsed = emailField.safeParse(fields.email);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, fields };
  }

  const supabase = await createServerActionClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    // Links only sign in existing accounts; creating an account goes through sign-up, which
    // asks for a name and a password.
    options: {
      shouldCreateUser: false,
      emailRedirectTo: await emailRedirectTo(formData),
    },
  });

  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      return {
        error: "We just sent you a link. Wait a minute before asking again.",
        fields,
      };
    }
    // "otp_disabled" is how Supabase says there's no such account. Answer as if we sent the
    // link, so this form can't be used to find out who has an account.
    if (error.code !== "otp_disabled") {
      console.error("Sign-in link failed", {
        code: error.code,
        status: error.status,
      });
      return { error: "We couldn't send the link. Please try again.", fields };
    }
  }

  redirect("/check-email");
}

export async function signOut() {
  const supabase = await createServerActionClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    // The local session cookies are cleared either way; this only means the server-side
    // session couldn't be revoked right now.
    console.error("Sign-out failed", {
      code: error.code,
      status: error.status,
    });
  }
  redirect("/");
}

import type { JwtPayload } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * The rules for a new password, mirroring the ones in supabase/config.toml, so users see the
 * reason before Supabase refuses it.
 */
export const newPasswordSchema = z
  .string()
  .regex(
    /^(?=.*[A-Za-z])(?=.*\d).{8,}$/,
    "Use at least 8 characters, with letters and numbers.",
  );

/** How long after following an email link a user may set a password without the current one. */
const EMAIL_LINK_GRACE_SECONDS = 60 * 60;

/**
 * Whether the session began from an email link (a password reset or sign-in link) in the last
 * hour. Supabase records both as an `otp` sign-in. Following one proves the user controls the
 * email address, so they may choose a new password without the current one, which someone
 * resetting a forgotten password doesn't have. Any other session must give the current
 * password, so a stolen session alone can't lock the owner out.
 */
export function cameFromEmailLink(
  claims: JwtPayload,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  return (claims.amr ?? []).some(
    (entry) =>
      typeof entry === "object" &&
      entry.method === "otp" &&
      nowSeconds - entry.timestamp < EMAIL_LINK_GRACE_SECONDS,
  );
}

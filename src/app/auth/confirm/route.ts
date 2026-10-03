import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { SIGNED_IN_HOME } from "@/lib/auth";
import { safeRedirectFromUrl } from "@/lib/safe-redirect";
import { createServerActionClient } from "@/lib/supabase/server";

// Target of the links in our auth emails (supabase/templates). Exchanges the one-time token
// hash for a session, which sets the session cookies, then sends the user on: a password reset
// to the page for choosing a new password; anything else back to the page that asked them to
// sign in (if it's on this site), or to SIGNED_IN_HOME.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Our templates only send type=email (confirm a sign-up, sign in) or type=recovery (reset a
  // password); anything else is not a link we issued.
  if (tokenHash && (type === "email" || type === "recovery")) {
    const supabase = await createServerActionClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      redirect(
        type === "recovery"
          ? "/settings/password"
          : safeRedirectFromUrl(
              searchParams.get("next"),
              origin,
              SIGNED_IN_HOME,
            ),
      );
    }
  }

  redirect("/login?error=link");
}

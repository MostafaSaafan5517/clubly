import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { SIGNED_IN_HOME } from "@/lib/auth";
import { safeRedirectFromUrl } from "@/lib/safe-redirect";
import { createServerActionClient } from "@/lib/supabase/server";

// Target of the links in our auth emails (supabase/templates). Exchanges the one-time token
// hash for a session, which sets the session cookies, then sends the user on: back to the page
// that asked them to sign in (if it's on this site), or to SIGNED_IN_HOME.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Our templates only ever send type=email; anything else is not a link we issued.
  if (tokenHash && type === "email") {
    const supabase = await createServerActionClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "email",
      token_hash: tokenHash,
    });
    if (!error) {
      redirect(
        safeRedirectFromUrl(searchParams.get("next"), origin, SIGNED_IN_HOME),
      );
    }
  }

  redirect("/login?error=link");
}

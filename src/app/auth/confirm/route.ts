import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createServerActionClient } from "@/lib/supabase/server";

// Target of the links in our auth emails (supabase/templates). Exchanges the one-time token
// hash for a session, which sets the session cookies, then sends the user into the app.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  // Our templates only ever send type=email; anything else is not a link we issued.
  if (tokenHash && type === "email") {
    const supabase = await createServerActionClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "email",
      token_hash: tokenHash,
    });
    if (!error) redirect("/dashboard");
  }

  redirect("/login?error=link");
}

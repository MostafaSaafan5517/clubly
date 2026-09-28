import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

/**
 * For Server Components. They can't set cookies, so this client never writes them: proxy.ts
 * has already refreshed the session before the page started rendering.
 */
export async function createServerComponentClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          // Read-only by design (see above).
        },
      },
    },
  );
}

/**
 * For Server Actions and Route Handlers, which can set cookies. Signing in, signing out and
 * confirming an email link all write the session cookies.
 */
export async function createServerActionClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}

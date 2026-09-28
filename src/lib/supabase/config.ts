// NEXT_PUBLIC_ variables must be read with literal property access: Next.js inlines them into
// the browser bundle at build time, and a dynamic process.env[name] lookup would be undefined.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Missing Supabase settings. Run `pnpm supabase start` then `pnpm env:local`, " +
      "or fill .env.local from .env.example.",
  );
}

export const supabaseConfig = { url, publishableKey } as const;

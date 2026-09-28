import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect("/login?next=/dashboard");

  // Read through RLS as the signed-in user: the policy only returns their own profile here.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", data.claims.sub)
    .single();
  if (error) throw new Error(`Could not load your profile: ${error.message}`);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          {appConfig.name}
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </header>
      <main className="mx-auto grid w-full max-w-3xl gap-2 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{profile.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-muted-foreground">Signed in as {profile.email}</p>
      </main>
    </div>
  );
}

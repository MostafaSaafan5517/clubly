import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { appConfig } from "@/config/app";
import { SIGNED_IN_HOME } from "@/lib/auth";
import { createServerComponentClient } from "@/lib/supabase/server";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { account } = await searchParams;
  // Signed-in visitors get a way in instead of the sign-up and sign-in buttons.
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      {account === "deleted" && !data && (
        <p role="status" className="mb-4 rounded-lg border px-4 py-2 text-sm">
          Your account is deleted.
        </p>
      )}
      <h1 className="text-4xl font-semibold tracking-tight">
        {appConfig.name}
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        {appConfig.description}
      </p>
      {/* Links styled as buttons: they navigate, so they must stay links for screen readers. */}
      {data ? (
        <Link
          href={SIGNED_IN_HOME}
          className={buttonVariants({ size: "lg", className: "mt-4" })}
        >
          Continue
        </Link>
      ) : (
        <div className="mt-4 flex gap-3">
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            Get started
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Sign in
          </Link>
        </div>
      )}
    </main>
  );
}

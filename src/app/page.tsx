import Link from "next/link";
import { Notice } from "@/components/notice";
import { buttonVariants } from "@/components/ui/button";
import { appConfig } from "@/config/app";
import { SIGNED_IN_HOME } from "@/lib/auth";
import { createServerComponentClient } from "@/lib/supabase/server";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { account } = await searchParams;
  // Signed-in visitors get a way in instead of the sign-up and sign-in buttons.
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getClaims();

  // The band, full height (DESIGN.md, The home page): the mark, the name as the sign, its one
  // sentence, and the way in. Left-aligned, like the join page's sign.
  return (
    <main className="flex flex-1 flex-col band">
      <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col justify-center gap-8 px-4 py-16 sm:px-8">
        {account === "deleted" && !data && (
          <div className="max-w-md">
            <Notice tone="info" role="status">
              Your account is deleted.
            </Notice>
          </div>
        )}
        <div className="grid gap-5">
          <span
            aria-hidden
            className="grid size-14 place-items-center rounded-surface bg-primary text-[2rem] leading-none font-extrabold text-primary-foreground"
          >
            {appConfig.name[0]}
          </span>
          <h1 className="text-display">{appConfig.name}</h1>
          <p className="max-w-[40ch] text-lead text-on-band-2">
            {appConfig.description}
          </p>
        </div>
        {/* Links styled as buttons: they navigate, so they must stay links for screen readers. */}
        {data ? (
          <div>
            <Link
              href={SIGNED_IN_HOME}
              className={buttonVariants({ size: "lg" })}
            >
              Continue
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Get started
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ size: "lg", variant: "band" })}
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

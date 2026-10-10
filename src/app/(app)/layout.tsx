import { IconInfoCircle, IconLogout } from "@tabler/icons-react";
import Link from "next/link";
import { MainNav } from "@/app/(app)/main-nav";
import { signOut } from "@/app/(auth)/actions";
import { AppMark } from "@/components/app-mark";
import { Button } from "@/components/ui/button";
import { SIGNED_IN_HOME } from "@/lib/auth";
import { DEMO_READ_ONLY_MESSAGE, isDemoAccount } from "@/lib/demo";
import { createServerComponentClient } from "@/lib/supabase/server";

// The signed-in part of the app: businesses people run (/dashboard), memberships they hold
// (/account) and their own settings (/settings). Each page checks the user itself
// (requireUser); a layout is not re-run on every navigation, so it must never be the only guard.
//
// The frame (DESIGN.md, The pages): a skip link, the demo note, then the ink band with the mark,
// the navigation and Sign out. Business pages continue the band with their name and tabs.
export default async function SignedInLayout({ children }: LayoutProps<"/">) {
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getClaims();
  const demo = data !== null && isDemoAccount(data.claims);

  return (
    <div className="flex flex-1 flex-col">
      <a
        href="#main"
        className="sr-only rounded-control bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10"
      >
        Skip to content
      </a>
      {demo && (
        <p className="flex items-start gap-2 bg-volt-soft px-4 py-2 text-small text-foreground sm:items-center sm:justify-center sm:px-6 lg:px-8">
          <IconInfoCircle
            size={16}
            stroke={1.75}
            aria-hidden
            className="mt-px shrink-0 sm:mt-0"
          />
          {DEMO_READ_ONLY_MESSAGE}
        </p>
      )}
      <header className="band">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2 sm:h-14 sm:flex-nowrap sm:px-6 sm:py-0 lg:px-8">
          <Link href={SIGNED_IN_HOME} className="rounded-control">
            <AppMark />
          </Link>
          <MainNav />
          <form action={signOut}>
            <Button type="submit" variant="band" size="sm">
              <IconLogout stroke={1.75} aria-hidden />
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 flex-col focus:outline-none"
      >
        {children}
      </main>
    </div>
  );
}

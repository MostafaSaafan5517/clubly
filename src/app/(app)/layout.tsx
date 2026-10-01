import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app";
import { SIGNED_IN_HOME } from "@/lib/auth";

// The signed-in part of the app: businesses people run (/dashboard) and memberships they hold
// (/account). Each page checks the user itself (requireUser); a layout is not re-run on every
// navigation, so it must never be the only guard.
export default function SignedInLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3 sm:gap-x-6 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href={SIGNED_IN_HOME} className="font-semibold tracking-tight">
            {appConfig.name}
          </Link>
          <nav aria-label="Main" className="flex gap-3 text-sm sm:gap-4">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground"
            >
              Businesses
            </Link>
            <Link
              href="/account"
              className="text-muted-foreground hover:text-foreground"
            >
              Memberships
            </Link>
          </nav>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <main className="mx-auto grid w-full max-w-3xl gap-8 p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}

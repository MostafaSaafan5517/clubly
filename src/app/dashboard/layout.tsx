import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app";

// Each page under /dashboard checks the user itself (requireUser); a layout is not re-run on
// every navigation, so it must never be the only guard.
export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          {appConfig.name}
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="outline">
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

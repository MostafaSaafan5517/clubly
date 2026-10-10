import type { Metadata } from "next";
import Link from "next/link";
import { AppMark } from "@/components/app-mark";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Any address the app doesn't have, and notFound() outside the signed-in pages (an unknown join
 * page, the email pages where emails are off). The home page's band, with a way back. It says
 * nothing about why: business pages answer 404 to outsiders so they can't tell what exists.
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col band">
      <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col justify-center gap-8 px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/" className="w-fit rounded-control">
          <AppMark />
        </Link>
        <div className="grid gap-5">
          <h1 className="text-display text-balance">Page not found</h1>
          <p className="max-w-[40ch] text-lead text-on-band-2">
            There&apos;s nothing at this address. Check the link, or start again
            from the home page.
          </p>
        </div>
        <div>
          <Link href="/" className={buttonVariants({ size: "lg" })}>
            Go to the home page
          </Link>
        </div>
      </div>
    </main>
  );
}

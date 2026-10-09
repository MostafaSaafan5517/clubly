import Link from "next/link";
import { AppMark } from "@/components/app-mark";
import { appConfig } from "@/config/app";

// Sign-in, sign-up and the email-link pages (DESIGN.md, Sign-in, sign-up, password): the ink band
// with the mark beside the form on chalk; on wide screens the band also carries the app's one
// sentence, like a sign. On phones it's a short strip above the form.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <header className="flex flex-col justify-between gap-10 band px-4 py-4 sm:px-8 lg:p-12">
        <Link href="/" className="inline-flex w-fit rounded-control">
          <AppMark />
        </Link>
        <p className="hidden max-w-[20ch] text-title text-balance text-on-band lg:block">
          {appConfig.description}
        </p>
      </header>
      <main className="flex flex-1 justify-center px-4 py-10 sm:px-8 lg:items-center">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

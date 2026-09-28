import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { appConfig } from "@/config/app";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">
        {appConfig.name}
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        {appConfig.description}
      </p>
      <div className="mt-4 flex gap-3">
        {/* Links styled as buttons: they navigate, so they must stay links for screen readers. */}
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
    </main>
  );
}

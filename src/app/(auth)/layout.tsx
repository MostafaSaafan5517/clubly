import Link from "next/link";
import { appConfig } from "@/config/app";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <Link href="/" className="text-xl font-semibold tracking-tight">
        {appConfig.name}
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { appConfig } from "@/config/app";
import "./globals.css";

// One variable font for everything (docs/design/DESIGN.md, Type); monospace text uses the
// system's own, so there's nothing else to download.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: appConfig.name, template: `%s | ${appConfig.name}` },
  description: appConfig.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

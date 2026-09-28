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
    </main>
  );
}

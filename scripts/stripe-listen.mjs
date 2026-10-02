// Runs `stripe listen`, forwarding the sandbox's Connect events to the local app, with the
// webhook signing secret redacted from its output: CI logs are public, and screens get shared.
// Used by `pnpm stripe:listen` and by Playwright (playwright.config.ts).
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

// Every event type the app handles. Add new ones here.
const EVENTS = [
  "account.updated",
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];

const listener = spawn(
  "stripe",
  [
    "listen",
    "--forward-connect-to",
    "localhost:3000/api/stripe/webhook",
    "--events",
    EVENTS.join(","),
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);

// Line by line, so a secret can't be split across two chunks of output.
for (const [from, to] of [
  [listener.stdout, process.stdout],
  [listener.stderr, process.stderr],
]) {
  createInterface({ input: from }).on("line", (line) => {
    to.write(`${line.replace(/whsec_[A-Za-z0-9]+/g, "whsec_[redacted]")}\n`);
  });
}

listener.on("error", (error) => {
  process.stderr.write(
    `Could not start the Stripe CLI (${error.message}). Is it installed and on your PATH?\n`,
  );
  process.exit(1);
});
listener.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => listener.kill(signal));
}

import { timingSafeEqual } from "node:crypto";

/**
 * Whether a request carries the cron secret the way Vercel Cron sends it
 * (`Authorization: Bearer <CRON_SECRET>`). The comparison takes the same time however much of
 * the secret matches, so response timing can't be used to guess it.
 */
export function isAuthorizedCronRequest(request: Request, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

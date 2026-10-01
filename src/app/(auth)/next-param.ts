// The auth pages pass a `next` path along (sign-in → sign-up → email link) so the user ends up
// back where they started. It's only ever followed through safeRedirectPath/safeRedirectFromUrl.

/** The `next` query parameter, if it has a single value. */
export function readNext(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

/** `path`, carrying `next` along. */
export function withNext(path: string, next: string | undefined) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

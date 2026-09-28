/**
 * Returns `next` only if it is a path on this site; otherwise the fallback. `next` comes from
 * the URL (for example /login?next=/dashboard), so without this check a crafted link could send
 * a freshly signed-in user to another site (an "open redirect").
 */
export function safeRedirectPath(
  next: string | null | undefined,
  fallback: string,
): string {
  if (!next || !next.startsWith("/")) return fallback;
  // "//evil.com" and "/\evil.com" are treated by browsers as links to another host.
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

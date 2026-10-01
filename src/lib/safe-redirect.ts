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

/**
 * The same check for a value that may be a full URL, like the redirect URL Supabase passes back
 * through an email link: it's kept only if it points at this site (`origin`), as a path.
 * The bare site root counts as "no preference", because that's Supabase's default.
 */
export function safeRedirectFromUrl(
  value: string | null | undefined,
  origin: string,
  fallback: string,
): string {
  if (!value) return fallback;
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    // Not a URL at all.
    return fallback;
  }
  if (url.origin !== origin) return fallback;
  if (url.pathname === "/" && !url.search) return fallback;
  return safeRedirectPath(url.pathname + url.search, fallback);
}

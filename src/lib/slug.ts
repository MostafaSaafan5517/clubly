// Mirrors the businesses.slug check constraint, so forms can explain a bad slug before the
// database rejects it. The database stays the source of truth.
export const MIN_SLUG_LENGTH = 3;
export const MAX_SLUG_LENGTH = 50;
export const SLUG_PATTERN = "[a-z0-9]+(-[a-z0-9]+)*";

/**
 * Turns a business name into a URL slug that satisfies the database rule:
 * lowercase letters and digits, words joined by single dashes. "Café Élan & Co." -> "cafe-elan-co".
 */
export function slugify(name: string): string {
  return (
    name
      // Split accented letters into letter + accent, then drop the accents.
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/^-+|-+$/g, "")
  );
}

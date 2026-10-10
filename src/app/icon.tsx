export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * The browser tab's icon: the mark, with the header mark's rounded corners. Every page loads this
 * module for its size and type, so the image code is imported only here, when the icon is drawn
 * (once, at build time).
 */
export default async function Icon() {
  const { markImage } = await import("@/lib/mark-image");
  return markImage(size.width, { rounded: true });
}

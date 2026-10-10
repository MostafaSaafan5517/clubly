export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * The home screen icon on iPhones and iPads: square, since iOS rounds the corners itself. Like the
 * tab icon, it imports the image code only when it's drawn (once, at build time).
 */
export default async function AppleIcon() {
  const { markImage } = await import("@/lib/mark-image");
  return markImage(size.width, { rounded: false });
}

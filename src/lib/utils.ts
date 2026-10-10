import { createCn } from "cn/engine";
import tables from "@/lib/cn-tables";

/**
 * Joins class names and settles Tailwind conflicts (the later class wins). Its tables include the
 * design system's own sizes, radii and shadows (`text-body`, `rounded-control`, `shadow-level-1`),
 * read from src/app/globals.css by `pnpm tokens`: without them `text-body` would count as a text
 * color and replace the color beside it.
 */
export const cn = createCn(tables);

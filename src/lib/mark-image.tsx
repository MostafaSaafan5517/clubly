import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { appConfig } from "@/config/app";
import tokens from "../../docs/design/tokens.json";

/**
 * The app's mark as a square image (DESIGN.md, Marks): the initial in Archivo 800 on volt, in the
 * proportions of the mark in the header. iOS rounds its icons itself, so the corners are optional.
 *
 * The image renderer reads ttf, otf and woff fonts (not the woff2 next/font serves) and has no
 * oklch, so the mark takes Archivo from its package and its colors as hex from the token export
 * (which src/styles/tokens.test.ts keeps in step with tokens.css). The font is read here, not at
 * module scope: the icons are drawn once, at build time.
 */
export async function markImage(
  side: number,
  { rounded }: { rounded: boolean },
) {
  const archivoExtraBold = await readFile(
    join(
      process.cwd(),
      "node_modules/@fontsource/archivo/files/archivo-latin-800-normal.woff",
    ),
  );
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: tokens.color.volt.light.hex,
        color: tokens.color["on-volt"].light.hex,
        borderRadius: rounded ? Math.round((side * 6) / 28) : 0,
        fontFamily: "Archivo",
        fontWeight: 800,
        fontSize: Math.round((side * 17) / 28),
        lineHeight: 1,
      }}
    >
      {appConfig.name[0]}
    </div>,
    {
      width: side,
      height: side,
      fonts: [
        {
          name: "Archivo",
          data: archivoExtraBold,
          weight: 800,
          style: "normal",
        },
      ],
    },
  );
}

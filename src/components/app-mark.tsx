import { appConfig } from "@/config/app";

/**
 * The app's mark and wordmark (DESIGN.md, Marks): the initial on a volt square, then the name. The
 * square is decoration, so a link around this is named by the wordmark alone.
 */
export function AppMark() {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-control bg-primary text-lead leading-none font-extrabold tracking-[-0.01em] text-primary-foreground"
      >
        {appConfig.name[0]}
      </span>
      <span className="text-lead leading-none font-extrabold tracking-[-0.01em]">
        {appConfig.name}
      </span>
    </span>
  );
}

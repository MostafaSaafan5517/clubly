import { IconChevronDown } from "@tabler/icons-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/** A native select styled like the text fields (DESIGN.md, Fields), with Tabler's chevron. */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div
      className={cn(
        "group/native-select relative w-fit has-[select:disabled]:opacity-50",
        className,
      )}
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        className="h-10 w-full min-w-0 appearance-none rounded-control border border-input bg-card py-1 pr-9 pl-3 text-base text-foreground transition-colors select-none selection:bg-primary selection:text-primary-foreground disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive md:text-body"
        {...props}
      />
      <IconChevronDown
        size={16}
        stroke={1.75}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3 select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOption };

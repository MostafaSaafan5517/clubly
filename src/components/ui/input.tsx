import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // DESIGN.md, Fields: 40px like the buttons beside them, a surface fill with a 3:1 edge,
        // and 16px text on phones so iOS doesn't zoom in on focus.
        "h-10 w-full min-w-0 rounded-control border border-input bg-card px-3 text-base text-foreground transition-[color,background-color,border-color] file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-ink-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-body",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

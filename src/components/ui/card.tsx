import * as React from "react";
import { cn } from "@/lib/utils";

// A surface (DESIGN.md, Depth): white on chalk with a hairline ring, 10px corners, 24px inside.

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-(--card-spacing) rounded-surface bg-card py-(--card-spacing) text-body text-card-foreground shadow-level-1 [--card-spacing:--spacing(6)]",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("grid gap-1.5 px-(--card-spacing)", className)}
      {...props}
    />
  );
}

/**
 * The card's title. A card that is the page's content (sign-in, an invite) passes `as="h1"`, so
 * the page has a real heading.
 */
function CardTitle({
  as: Tag = "div",
  className,
  ...props
}: React.ComponentProps<"div"> & { as?: "div" | "h1" | "h2" }) {
  return (
    <Tag
      data-slot="card-title"
      className={cn("text-title", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-body text-ink-2", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent };

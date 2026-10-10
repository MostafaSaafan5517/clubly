import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// DESIGN.md, Components: 40px controls (44px for a page's main action), 6px corners, labels in
// Body at 600 (Label on small ones). Only colors and position transition, so the focus outline
// appears at once instead of animating in.
const buttonClasses = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-control border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Volt under ink, with a darker edge along the bottom.
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_-2px_0_color-mix(in_oklch,var(--ds-on-volt)_14%,transparent)] hover:bg-primary-strong",
        outline: "border-input bg-card text-foreground hover:bg-muted",
        // Actions that take something away (suspend, remove, revoke): quiet until hovered.
        "destructive-outline":
          "border-input bg-card text-destructive hover:bg-destructive-soft",
        // On the ink band, where an outline would disappear.
        band: "bg-band-2 text-on-band hover:bg-[color-mix(in_oklch,var(--ds-band-2),var(--ds-on-band)_10%)]",
        // Solid, with its own text color: light on the light theme's red, dark on the dark theme's
        // lighter red (white on it would fail contrast).
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "h-10 px-4 text-body",
        sm: "h-8 gap-1.5 px-3 text-label",
        lg: "h-11 px-5 text-body",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * The button's classes, merged so a variant's classes replace the base ones they conflict with
 * (the outline variant's border color over the base's transparent one). Links styled as buttons
 * use this directly, so they need the merge as much as <Button> does.
 */
function buttonVariants(props?: Parameters<typeof buttonClasses>[0]) {
  return cn(buttonClasses(props));
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonClasses>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}

export { Button, buttonVariants };

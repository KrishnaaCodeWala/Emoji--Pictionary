import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-bold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          // Thematic styling: defaults to vintage rubber hose (thick borders, heavy shadows),
          // but adapts if inside a .theme-modern container.
          "border-2 border-border shadow-[4px_4px_0_0_var(--color-border)] active:shadow-none active:translate-y-1 active:translate-x-1",
          {
            "bg-primary text-primary-foreground hover:bg-primary-hover": variant === "default",
            "bg-background hover:bg-surface-muted": variant === "outline",
            "border-transparent shadow-none hover:bg-surface-muted hover:text-foreground": variant === "ghost",
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-md px-3": size === "sm",
            "h-11 rounded-md px-8 text-base": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }

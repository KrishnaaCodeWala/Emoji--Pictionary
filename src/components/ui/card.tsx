import * as React from "react"
import { motion, HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"

export interface CardProps extends HTMLMotionProps<"div"> {
  vintage?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, vintage = true, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl bg-surface text-foreground",
        vintage 
          ? "border-4 border-border shadow-[8px_8px_0_0_var(--color-border)] p-6" 
          : "border border-border/50 shadow-xl backdrop-blur-md bg-surface/80 p-6",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

export { Card }

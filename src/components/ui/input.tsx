import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  vintage?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, vintage = true, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          vintage 
            ? "border-b-4 border-l-2 border-border bg-transparent font-mono placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-0" 
            : "border border-border/50 bg-surface/50 placeholder:text-muted-foreground/50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

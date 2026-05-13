import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-transparent",
        secondary:
          "bg-secondary text-secondary-foreground border-transparent",
        outline:
          "border-border text-foreground bg-transparent",
        destructive:
          "bg-bad/10 text-bad border-bad/20",
        ok:
          "bg-ok/10 text-ok border-ok/20",
        warn:
          "bg-warn/10 text-warn border-warn/20",
        bad:
          "bg-bad/10 text-bad border-bad/20",
        pending:
          "bg-muted text-muted-foreground border-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean
}

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : "span"
  return (
    <Comp className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

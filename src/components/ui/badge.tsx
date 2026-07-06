import * as React from "react"

import { cn } from "@/lib/utils"

function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "secondary" | "outline" | "success" | "warning"
}) {
  const styles: Record<string, string> = {
    default: "border border-cyan-400/30 bg-cyan-400/15 text-cyan-200",
    secondary: "border border-white/10 bg-white/5 text-slate-200",
    outline: "border border-white/15 bg-transparent text-slate-300",
    success: "border border-emerald-400/30 bg-emerald-400/15 text-emerald-200",
    warning: "border border-amber-400/30 bg-amber-400/15 text-amber-200",
  }

  return (
    <div
      data-slot="badge"
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        styles[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }

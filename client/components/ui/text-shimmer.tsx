"use client"

import { cn } from "@/lib/utils"

export type TextShimmerProps = {
  as?: keyof React.JSX.IntrinsicElements
  duration?: number
  spread?: number
  children: React.ReactNode
} & React.HTMLAttributes<HTMLElement>

export function TextShimmer({
  as = "span",
  className,
  duration = 4,
  spread = 20,
  children,
  style,
  ...props
}: TextShimmerProps) {
  const dynamicSpread = Math.min(Math.max(spread, 5), 45)
  const Component = as as React.ElementType

  return (
    <Component
      className={cn(
        "inline-block animate-[shimmer_4s_infinite_linear] bg-[linear-gradient(to_right,var(--muted-foreground)_40%,var(--foreground)_60%,var(--muted-foreground)_80%)] bg-[length:200%_auto] bg-clip-text text-transparent",
        className
      )}
      style={{ animationDuration: `${duration}s`, ...style }}
      {...props}
    >
      <span
        style={{
          maskImage: `linear-gradient(90deg, transparent, black ${dynamicSpread}%, black calc(100% - ${dynamicSpread}%), transparent)`,
          WebkitMaskImage: `linear-gradient(90deg, transparent, black ${dynamicSpread}%, black calc(100% - ${dynamicSpread}%), transparent)`
        }}
      >
        {children}
      </span>
    </Component>
  )
}

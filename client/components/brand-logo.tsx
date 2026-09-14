import { cn } from "@/lib/utils";

export function BrandLogo({ className, showGlow = false }: { className?: string; showGlow?: boolean }) {
  return (
    <span className={cn("inline-flex h-7 w-7 shrink-0", showGlow && "accent-glow", className)}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block h-full w-full"
        aria-hidden="true"
      >
        {/* Background */}
        <rect width="32" height="32" rx="7" className="fill-primary" />

        {/* Vertical stem — split into two segments with a tiny gap around the midpoint,
            giving a subtle notch that reads as intentional design, not a break */}
        {/* Upper stem: 9 → 14.2 */}
        <path
          d="M10.5 9v5.2"
          className="stroke-primary-foreground"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Lower stem: 15.8 → 23 */}
        <path
          d="M10.5 15.8v7.2"
          className="stroke-primary-foreground"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Upper diagonal arm: stem mid → top right */}
        <path
          d="M10.5 16L16.5 9"
          className="stroke-primary-foreground"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Lower diagonal arm: stem mid → bottom right */}
        <path
          d="M10.5 16l9 8"
          className="stroke-primary-foreground"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Accent dot — top right, unchanged */}
        <circle cx="23" cy="9" r="2" className="fill-[hsl(var(--accent-glow))]" />

        {/* Tiny fill dot bridging the gap — same colour as background so it reads
            as a cut rather than a disconnection, keeping the K recognisable */}
        <circle cx="10.5" cy="15" r="1.1" className="fill-primary" />
      </svg>
    </span>
  );
}

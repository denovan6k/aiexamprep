import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { asRoute, cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

type ItemCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  meta?: string;
  href?: string;
  onClick?: () => void;
};

type StatProps = {
  label: string;
  value?: string;
  items?: Array<{ label: string; icon: LucideIcon }>;
  icon?: LucideIcon;
  trend?: string;
  tone?: "default" | "success" | "warning" | "danger";
};

const toneBadge: Record<NonNullable<StatProps["tone"]>, "secondary" | "success" | "warning" | "danger"> = {
  default: "secondary",
  success: "success",
  warning: "warning",
  danger: "danger"
};

const toneValue: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger"
};

const toneIconBg: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger"
};

const toneItemChip: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "border-border bg-muted/50 text-foreground",
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/20 bg-warning/10 text-warning",
  danger: "border-danger/20 bg-danger/10 text-danger"
};

export function PageFrame({
  children,
  narrow = false,
  className
}: {
  children: ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8",
        narrow ? "max-w-md" : "max-w-6xl",
        className
      )}
    >
      {children}
    </main>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <section className="pb-5 sm:pb-10">
      <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          {eyebrow ? <p className="mb-3 text-sm font-medium text-primary">{eyebrow}</p> : null}
          <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          {description ? (
            <p className="mt-2 text-base leading-relaxed text-muted-foreground sm:mt-4">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

export function PrimaryLink({ href: path, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={asRoute(path)} className={cn(buttonVariants({ size: "default" }), "rounded-full")}>
      {children}
    </Link>
  );
}

export function SecondaryLink({ href: path, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={asRoute(path)} className={cn(buttonVariants({ variant: "outline", size: "default" }), "rounded-full")}>
      {children}
    </Link>
  );
}

export function AppNav() {
  return null;
}

export function ItemCard({ eyebrow, title, description, meta, href, onClick }: ItemCardProps) {
  const interactive = Boolean(href || onClick);
  const content = (
    <Card
      className={cn(
        "h-full transition-all duration-200",
        interactive && "cursor-pointer hover:border-primary/30 hover:bg-accent/50 hover:shadow-sm"
      )}
    >
      <CardHeader>
        {eyebrow ? (
          <Badge variant="outline" className="mb-3 w-fit border-primary/20 text-primary">
            {eyebrow}
          </Badge>
        ) : null}
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="leading-relaxed">{description}</CardDescription>
      </CardHeader>
      {meta ? (
        <CardFooter className="mt-auto border-t border-border pt-4">
          <span className="text-xs font-medium text-muted-foreground">{meta}</span>
        </CardFooter>
      ) : null}
    </Card>
  );

  if (href) {
    return (
      <Link href={asRoute(href)} className="block h-full">
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block h-full w-full text-left">
        {content}
      </button>
    );
  }

  return content;
}

export function Stat({ label, value, items, icon: Icon, trend, tone = "default" }: StatProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {Icon ? (
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneIconBg[tone])}>
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
        </div>
        {value !== undefined ? (
          <p className={cn("text-3xl font-medium tracking-tight tabular-nums", toneValue[tone])}>{value}</p>
        ) : null}
        {items?.length ? (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <span
                key={item.label}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                  toneItemChip[tone]
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
                {item.label}
              </span>
            ))}
          </div>
        ) : null}
        {trend ? (
          <Badge variant={toneBadge[tone]} className="mt-2 w-fit">
            {trend}
          </Badge>
        ) : null}
      </CardHeader>
    </Card>
  );
}

type StatStripItem = {
  label: string;
  value: string;
  tone?: NonNullable<StatProps["tone"]>;
  hint?: string;
};

export function StatStrip({ items, className }: { items: StatStripItem[]; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-x-6 gap-y-3 border-t border-border/60 pt-4",
        className
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-[5rem]">
          <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
          <p className={cn("text-xl font-medium tabular-nums tracking-tight", toneValue[item.tone ?? "default"])}>
            {item.value}
          </p>
          {item.hint ? <p className="mt-0.5 max-w-[10rem] truncate text-xs text-muted-foreground">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

type ResourceListRowProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  meta?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  href?: string;
  className?: string;
};

export function ResourceListRow({
  icon,
  title,
  description,
  meta,
  badge,
  actions,
  href,
  className
}: ResourceListRowProps) {
  const content = (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 transition-colors",
        href && "hover:border-primary/25 hover:bg-muted/30",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {icon ? <div className="shrink-0">{icon}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{title}</p>
            {badge}
          </div>
          {description ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
          {meta ? <div className="mt-1 text-xs text-muted-foreground">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={asRoute(href)} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

export function FormField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const fieldId = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>
      {multiline ? (
        <textarea
          id={fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      ) : (
        <Input
          id={fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export function Field({
  label,
  type = "text",
  placeholder,
  hint,
  id
}: {
  label: string;
  type?: string;
  placeholder: string;
  hint?: string;
  id?: string;
}) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <Input id={fieldId} type={type} placeholder={placeholder} />
    </div>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return <Card className="border-border shadow-card">{children}</Card>;
}

export function SectionGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const colClass = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 xl:grid-cols-4"
  }[cols];

  return <section className={cn("mt-8 grid gap-4", colClass)}>{children}</section>;
}

export function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6 mt-12 first:mt-0">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p> : null}
    </div>
  );
}

export { Badge, Button, Card, Input, Label, Textarea };

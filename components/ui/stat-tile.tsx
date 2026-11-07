import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "success" | "danger" | "warning" | "info";
  className?: string;
}

const toneClass: Record<NonNullable<StatTileProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  danger: "text-destructive",
  warning: "text-warning",
  info: "text-info",
};

export function StatTile({ label, value, hint, icon, tone = "default", className }: StatTileProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 shadow-xs", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
      </div>
      <p className={cn("mt-2 text-2xl font-semibold leading-none tracking-tight", toneClass[tone])}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

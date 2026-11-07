import Form from "next/form";
import type { ReactNode } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  action: string;
  children: ReactNode;
  resetHref?: string;
  /** Params to carry through the GET submission unchanged. */
  hidden?: Record<string, string | undefined>;
  className?: string;
}

/** GET filter form – submitting navigates client-side with the inputs encoded as search params. */
export function FilterBar({ action, children, resetHref, hidden, className }: FilterBarProps) {
  return (
    <Form
      action={action}
      className={cn("mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3 shadow-xs no-print", className)}
    >
      {hidden
        ? Object.entries(hidden)
            .filter(([, v]) => v !== undefined && v !== "")
            .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
        : null}
      {children}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" size="sm">
          Apply
        </Button>
        {resetHref ? (
          <LinkButton href={resetHref} variant="ghost" size="sm">
            Reset
          </LinkButton>
        ) : null}
      </div>
    </Form>
  );
}

export function FilterField({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

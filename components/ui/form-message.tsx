import { CircleCheck, CircleX } from "lucide-react";
import type { ActionState } from "@/lib/actions/types";
import { cn } from "@/lib/utils";

export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  if (state.status === "error" && state.message) {
    return (
      <div
        role="alert"
        className={cn(
          "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive",
          className,
        )}
      >
        <CircleX className="mt-0.5 size-4 shrink-0" />
        <span>{state.message}</span>
      </div>
    );
  }
  if (state.status === "success" && state.message) {
    return (
      <div
        role="status"
        className={cn(
          "flex items-start gap-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm text-success",
          className,
        )}
      >
        <CircleCheck className="mt-0.5 size-4 shrink-0" />
        <span>{state.message}</span>
      </div>
    );
  }
  return null;
}

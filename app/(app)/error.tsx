"use client";

import { useEffect } from "react";
import { CircleX } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message =
    error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string"
      ? (error as { message: string }).message
      : "An unexpected error occurred.";

  return (
    <div className="mx-auto mt-16 max-w-lg rounded-lg border border-destructive/30 bg-card p-8 text-center shadow-xs">
      <CircleX className="mx-auto size-10 text-destructive" />
      <h2 className="mt-4 text-lg font-semibold">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        If this keeps happening, check that DATABASE_URL points to your Neon database and that migrations have run.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <LinkButton href="/" variant="outline">
          Go to dashboard
        </LinkButton>
      </div>
    </div>
  );
}

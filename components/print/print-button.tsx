"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

export function PrintButton({ children, ...props }: ButtonProps) {
  return (
    <Button type="button" onClick={() => window.print()} {...props}>
      <Printer />
      {children ?? "Print / Save PDF"}
    </Button>
  );
}

/** Opens the browser print dialog once the page has rendered. */
export function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, [enabled]);
  return null;
}

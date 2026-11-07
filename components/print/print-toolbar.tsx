import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AutoPrint, PrintButton } from "@/components/print/print-button";

interface PrintToolbarProps {
  backHref: string;
  backLabel: string;
  title: string;
  autoPrint?: boolean;
}

export function PrintToolbar({ backHref, backLabel, title, autoPrint = false }: PrintToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
      <div className="flex items-center gap-3">
        <Link href={backHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft /> {backLabel}
        </Link>
        <h1 className="text-sm font-medium text-muted-foreground">{title}</h1>
      </div>
      <PrintButton size="sm" />
      <AutoPrint enabled={autoPrint} />
    </div>
  );
}

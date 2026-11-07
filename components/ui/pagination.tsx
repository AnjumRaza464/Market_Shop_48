import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { qs } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | number | undefined>;
}

export function Pagination({ page, pageSize, total, basePath, params }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = (p: number) => `${basePath}${qs({ ...params, page: p === 1 ? undefined : p })}`;

  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground no-print">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Link
          href={link(page - 1)}
          aria-disabled={page <= 1}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}
        >
          <ChevronLeft /> Prev
        </Link>
        <span className="tabular">
          Page {page} / {pages}
        </span>
        <Link
          href={link(page + 1)}
          aria-disabled={page >= pages}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pages && "pointer-events-none opacity-50")}
        >
          Next <ChevronRight />
        </Link>
      </div>
    </div>
  );
}

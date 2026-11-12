import type { Metadata } from "next";
import { Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatSkeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { BACKUP_SHEETS, getBackupCounts } from "@/lib/export/workbook";
import { requestToday } from "@/lib/request";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Excel backup" };

export default function ExportPage() {
  return (
    <>
      <PageHeader
        title="Excel Backup"
        description="Download every khata, bill, expense and cash movement as one formatted Excel file – keep it as a backup or open it to check the books."
        actions={
          <a href="/export/download" className={cn(buttonVariants({ variant: "default" }))}>
            <Download /> Download Excel backup
          </a>
        }
      />
      <Suspense fallback={<StatSkeleton count={4} />}>
        <ExportContent />
      </Suspense>
    </>
  );
}

async function ExportContent() {
  const [counts, today] = await Promise.all([getBackupCounts(), requestToday()]);
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Rows in the backup" value={String(totalRows)} hint={`Across ${BACKUP_SHEETS.length} sheets · as of ${formatDate(today)}`} icon={<FileSpreadsheet />} />
        <StatTile label="Suppliers · bills" value={`${counts.parties} · ${counts.bills}`} hint={`${counts.billItems} item lines · ${counts.transactions} ledger rows`} />
        <StatTile label="Customers · khata rows" value={`${counts.customers} · ${counts.saleEntries}`} hint="Goods given and cash received" />
        <StatTile label="Expenses · cash entries" value={`${counts.expenses} · ${counts.cashEntries}`} hint={`${counts.partners} partner(s)`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>What is in the file</CardTitle>
            <CardDescription>
              One sheet per module. Numbers and dates are real Excel values, so you can sort, filter and total them; every money column already has a total row and the header row stays frozen while you scroll.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <Tr>
                  <Th>Sheet</Th>
                  <Th>Contents</Th>
                </Tr>
              </THead>
              <TBody>
                {BACKUP_SHEETS.map((s) => (
                  <Tr key={s.name}>
                    <Td className="whitespace-nowrap font-medium">{s.name}</Td>
                    <Td className="text-muted-foreground">{s.description}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="size-4" /> Download
              </CardTitle>
              <CardDescription>The file is built fresh from the database each time you click, so it always has the latest figures.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <a href="/export/download" className={cn(buttonVariants({ variant: "default", size: "lg" }), "w-full")}>
                <Download /> Download Excel backup (.xlsx)
              </a>
              <p className="text-xs text-muted-foreground">File name: shop name + backup + the export date. Opens in Microsoft Excel, LibreOffice, Google Sheets and on a phone.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4" /> Backup habit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                <li>Download once a week (or after a busy day) and keep the files in Google Drive, WhatsApp “saved messages” or a USB.</li>
                <li>Keep old backups – each file is a snapshot of that date, handy when a party disputes an old balance.</li>
                <li>The Summary sheet shows cash in hand, payables and dues on the day of export – compare it with your cash box.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

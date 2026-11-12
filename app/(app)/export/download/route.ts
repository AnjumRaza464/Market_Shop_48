import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/actions/guard";
import { buildBackupWorkbook } from "@/lib/export/workbook";

/** GET /export/download → the full Excel backup as a file download. */
export async function GET(_request: NextRequest) {
  await requireSession();
  const { buffer, filename } = await buildBackupWorkbook();
  return new Response(new Blob([buffer as BlobPart]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}

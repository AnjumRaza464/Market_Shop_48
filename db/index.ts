import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/**
 * One Neon connection pool per server instance.
 *
 * - Single statements go over HTTP (`poolQueryViaFetch`) → lowest latency on serverless.
 * - `db.transaction()` transparently uses a WebSocket connection so a bill, its line
 *   items and its ledger entry are committed atomically.
 * - Node ≥ 22 ships a global WebSocket, so no `ws` polyfill is needed.
 */
neonConfig.poolQueryViaFetch = true;

const connectionString = process.env.DATABASE_URL;
if (!connectionString && process.env.NEXT_PHASE !== "phase-production-build") {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string.",
  );
}

const globalForDb = globalThis as unknown as { __market48Pool?: Pool };
const pool = globalForDb.__market48Pool ?? new Pool({ connectionString });
if (process.env.NODE_ENV !== "production") globalForDb.__market48Pool = pool;

export const db = drizzle({ client: pool, schema });
export type Db = typeof db;
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };

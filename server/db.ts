import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                       // bounded pool — floods can't exhaust connections
  connectionTimeoutMillis: 5000, // fail fast instead of hanging when pool is full
  idleTimeoutMillis: 30000,
  statement_timeout: 10000,      // no user-triggered query may run >10s (DoS guard)
});
export const db = drizzle(pool, { schema });

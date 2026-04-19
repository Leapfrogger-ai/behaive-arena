import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;
export type Sql = ReturnType<typeof createSql>;

// Pooled client for app queries. `prepare: false` matches PgBouncer / PGPool
// expectations; if you're on direct connections you can flip it to `true`.
export function createSql(connectionString: string) {
  return postgres(connectionString, {
    prepare: false,
    max: 10,
  });
}

export function createDb(connectionString: string) {
  return drizzle(createSql(connectionString), { schema });
}

// Dedicated single-connection client for `LISTEN <channel>`. Must NOT be the
// pooled instance — LISTEN sits on a single backend for its lifetime and
// pool rotation breaks the subscription. Typical use: one listener per SSE
// subscriber, closed when the HTTP response aborts.
export function createListener(connectionString: string) {
  return postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 0,
    max_lifetime: 0,
  });
}

export { schema };

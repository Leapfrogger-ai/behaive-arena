import { createDb, createListener, createSql } from "@behaive/db";
import { serverEnv } from "./env";

// We cache handles per-process so the Next dev server's hot reload doesn't
// exhaust Postgres's connection slots. `globalThis` is the canonical way
// to survive module re-evaluation under next/turbopack.

type Handles = {
  db: ReturnType<typeof createDb>;
  sql: ReturnType<typeof createSql>;
};

declare global {
  // eslint-disable-next-line no-var
  var __behaiveDbHandles: Handles | undefined;
}

export function db() {
  if (!globalThis.__behaiveDbHandles) {
    const url = serverEnv().DATABASE_URL;
    globalThis.__behaiveDbHandles = {
      db: createDb(url),
      sql: createSql(url),
    };
  }
  return globalThis.__behaiveDbHandles.db;
}

export function sql() {
  if (!globalThis.__behaiveDbHandles) db();
  return globalThis.__behaiveDbHandles!.sql;
}

// Fresh single-connection client per call — caller owns the lifecycle.
// Used by the SSE route so each subscriber has its own LISTEN connection.
export function listener() {
  return createListener(serverEnv().DATABASE_URL);
}

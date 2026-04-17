import PgBoss from "pg-boss";
import { logger } from "./logger.js";

export const RUN_QUEUE = "arena.run";

export interface RunJobData {
  runId: string;
  orgId: string;
}

export async function createQueue(connectionString: string): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString,
    schema: "pgboss",
    // Retention matches "researchers can re-trigger a failed run" — if a job
    // sits too long it's safer to surface it as failed than auto-complete.
    retentionDays: 7,
  });
  boss.on("error", (err: unknown) => {
    logger.error({ err }, "pg-boss error");
  });
  await boss.start();
  await boss.createQueue(RUN_QUEUE);
  return boss;
}

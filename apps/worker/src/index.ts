/**
 * arena-worker entrypoint.
 *
 * Subscribes to the `arena.run` pg-boss queue. Each job carries a runId
 * that points at a `runs` row in Postgres; the handler defers to runGame
 * which orchestrates the entire Ultimatum Game session end-to-end.
 */
import { loadEnv } from "./env";
import { createQueue, RUN_QUEUE, type RunJobData } from "./queue";
import { runGame } from "./run-game";
import { logger } from "./logger";

async function main() {
  const env = loadEnv();
  const boss = await createQueue(env.DATABASE_URL);

  logger.info("arena-worker online; awaiting run jobs");

  await boss.work<RunJobData>(RUN_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const { runId } = job.data;
      logger.info({ runId, jobId: job.id }, "picked up run");
      await runGame(runId);
    }
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down worker");
    await boss.stop({ graceful: true, timeout: 30_000 });
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "worker failed to start");
  process.exit(1);
});

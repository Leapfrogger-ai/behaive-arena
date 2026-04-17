/**
 * arena-worker entrypoint.
 *
 * Loop:
 *  1. Connect to Supabase (service role) + pg-boss queue.
 *  2. Subscribe to arena.run jobs.
 *  3. For each job, hand off to executeRun — which in W1 is a stub, and in
 *     W4-5 becomes the real agent loop (provider SDKs, on-chain writes).
 *
 * Kept deliberately thin so integration tests can stub the queue + supabase
 * client and drive executeRun directly.
 */
import { loadEnv } from "./env.js";
import { createQueue, RUN_QUEUE, type RunJobData } from "./queue.js";
import { executeRun } from "./run.js";
import { createServiceClient } from "./supabase.js";
import { logger } from "./logger.js";

async function main() {
  const env = loadEnv();
  const supabase = createServiceClient(env);
  const boss = await createQueue(env.SUPABASE_DB_URL);

  logger.info("arena-worker online; awaiting run jobs");

  await boss.work<RunJobData>(RUN_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const { runId } = job.data;
      logger.info({ runId }, "picked up run");
      try {
        await executeRun({ supabase, runId });
      } catch (err) {
        logger.error({ err, runId }, "run failed");
        await supabase
          .from("runs")
          .update({ status: "failed", error: String((err as Error).message ?? err) })
          .eq("id", runId);
        throw err;
      }
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

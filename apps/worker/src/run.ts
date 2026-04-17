import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";

// The real agent loop lands in W4-5 per the plan. For now we expose a
// typed seam that the queue handler can call, and a sibling fake-runner
// that the W1 milestone uses to validate the SSE / Realtime path end-to-end.

export interface RunContext {
  supabase: SupabaseClient;
  runId: string;
}

export async function executeRun(ctx: RunContext): Promise<void> {
  logger.warn(
    { runId: ctx.runId },
    "executeRun: not implemented yet — schedule fake-runner in W1, real agent loop in W4-5",
  );
  await ctx.supabase
    .from("runs")
    .update({ status: "failed", error: "agent loop not implemented" })
    .eq("id", ctx.runId);
}

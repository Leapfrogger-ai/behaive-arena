/**
 * W1 validation: emit synthetic Ultimatum-game messages against a real run
 * row so we can wire up SSE, Realtime, and the public /run/[slug] page
 * before any agent / on-chain code exists.
 *
 * Usage:
 *   tsx src/fake-runner.ts <runId>
 *
 * If <runId> is omitted we create a new run under the seeded demo org and
 * print its id + public slug so the caller can open the live page.
 */
import { loadEnv } from "./env.js";
import { createServiceClient } from "./supabase.js";
import { logger } from "./logger.js";

const SCRIPT: Array<{
  delayMs: number;
  role: "researcher" | "proposer" | "responder";
  from: string;
  content: string;
  event: "game_start" | "offer" | "response" | "verdict" | "chat";
  round?: number;
  payload?: Record<string, unknown>;
}> = [
  {
    delayMs: 0,
    role: "researcher",
    from: "researcher",
    content: "Game start — endowment $10, 3 rounds, persona: fair for proposer.",
    event: "game_start",
    payload: { endowment: 10, rounds: 3, persona: "fair" },
  },
  {
    delayMs: 1200,
    role: "proposer",
    from: "proposer",
    round: 1,
    content: "I offer $4 out of $10.",
    event: "offer",
    payload: { amount: 4, round: 1 },
  },
  {
    delayMs: 1600,
    role: "responder",
    from: "responder",
    round: 1,
    content: "ACCEPTED.",
    event: "response",
    payload: { verdict: "accepted", round: 1 },
  },
  {
    delayMs: 1200,
    role: "researcher",
    from: "researcher",
    round: 1,
    content: "Round 1 settled: proposer 6, responder 4.",
    event: "verdict",
    payload: { round: 1, proposer: 6, responder: 4 },
  },
  {
    delayMs: 1400,
    role: "proposer",
    from: "proposer",
    round: 2,
    content: "I offer $3 out of $10.",
    event: "offer",
    payload: { amount: 3, round: 2 },
  },
  {
    delayMs: 1400,
    role: "responder",
    from: "responder",
    round: 2,
    content: "REJECTED.",
    event: "response",
    payload: { verdict: "rejected", round: 2 },
  },
  {
    delayMs: 1200,
    role: "researcher",
    from: "researcher",
    round: 2,
    content: "Round 2 settled: both 0.",
    event: "verdict",
    payload: { round: 2, proposer: 0, responder: 0 },
  },
  {
    delayMs: 1400,
    role: "proposer",
    from: "proposer",
    round: 3,
    content: "I offer $5 out of $10.",
    event: "offer",
    payload: { amount: 5, round: 3 },
  },
  {
    delayMs: 1400,
    role: "responder",
    from: "responder",
    round: 3,
    content: "ACCEPTED.",
    event: "response",
    payload: { verdict: "accepted", round: 3 },
  },
  {
    delayMs: 1200,
    role: "researcher",
    from: "researcher",
    round: 3,
    content: "Round 3 settled: proposer 5, responder 5.",
    event: "verdict",
    payload: { round: 3, proposer: 5, responder: 5 },
  },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const env = loadEnv();
  const sb = createServiceClient(env);

  const argRunId = process.argv[2];
  let runId: string;
  let publicSlug: string;

  if (argRunId) {
    const { data, error } = await sb
      .from("runs")
      .select("id, public_slug")
      .eq("id", argRunId)
      .single();
    if (error) throw error;
    runId = data.id;
    publicSlug = data.public_slug;
  } else {
    // Look up the demo org + experiment seeded for local dev.
    const { data: org, error: orgErr } = await sb
      .from("orgs")
      .select("id")
      .eq("slug", "demo")
      .single();
    if (orgErr || !org) throw new Error(`no demo org seeded: ${orgErr?.message}`);

    const { data: exp, error: expErr } = await sb
      .from("experiments")
      .select("id, config")
      .eq("org_id", org.id)
      .limit(1)
      .single();
    if (expErr || !exp) throw new Error(`no experiment for demo org: ${expErr?.message}`);

    publicSlug = `fake-${Date.now().toString(36)}`;
    const { data: run, error: runErr } = await sb
      .from("runs")
      .insert({
        experiment_id: exp.id,
        org_id: org.id,
        public_slug: publicSlug,
        status: "running",
        visibility: "public",
        config_snapshot: exp.config,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (runErr || !run) throw new Error(`insert run failed: ${runErr?.message}`);
    runId = run.id;
  }

  logger.info({ runId, publicSlug }, "fake-runner: starting synthetic Ultimatum game");

  for (const step of SCRIPT) {
    await sleep(step.delayMs);
    const { error } = await sb.from("messages").insert({
      run_id: runId,
      round_number: step.round ?? null,
      agent_role: step.role,
      from_agent: step.from,
      content: step.content,
      event_type: step.event,
      payload: step.payload ?? null,
    });
    if (error) {
      logger.error({ err: error, step }, "fake-runner: insert failed");
      throw error;
    }
    logger.info({ round: step.round, event: step.event }, "fake-runner: emitted");
  }

  await sb
    .from("runs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", runId);

  logger.info({ runId, publicSlug }, "fake-runner: done");
}

main().catch((err) => {
  logger.error({ err }, "fake-runner failed");
  process.exit(1);
});

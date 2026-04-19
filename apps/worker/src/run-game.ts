/**
 * run-game.ts — the Behaive Arena agent loop.
 *
 * Given an existing `runs` row, this orchestrator:
 *   1. Mints ephemeral proposer/responder wallets; funds them from the
 *      AGENT_FUNDER anvil account with ETH + MockUSDC.
 *   2. Registers each agent against the on-chain AgentRegistry and records
 *      the returned agentId on `agent_instances`.
 *   3. Runs N rounds. Each turn emits a `messages` row → Postgres trigger
 *      pg_notify's the public run page → SSE fan-out.
 *   4. On an accepted offer, executes a real USDC transfer from proposer to
 *      responder via `packages/chain/usdc`.
 *   5. At run end, each party signs an EIP-712 `Feedback` for every round
 *      and the platform signer submits the whole batch on-chain in one tx.
 *   6. Flips `runs.status = 'completed'`, records per-event tx hashes.
 *
 * Usage:
 *   tsx src/run-game.ts <runId>          — run a specific queued row
 *   tsx src/run-game.ts                  — create a run under the demo
 *                                          experiment, then run it
 */
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { formatUnits, hexToBigInt, keccak256, toHex, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import * as schema from "@behaive/db/schema";
import {
  dimensionKey,
  metadataHash,
  publicClient,
  registerAgent,
  signFeedback,
  submitFeedbackBatch,
  sendUsdc,
  walletClient,
  type SignedFeedback,
} from "@behaive/chain";
import { erc20Abi } from "@behaive/chain/abi";
import { loadEnv } from "./env";
import { logger } from "./logger";
import { mulberry32 } from "./rng";
import {
  grade,
  proposerOffer,
  responderDecision,
  type ProposerPersona,
  type ResponderPersona,
} from "./personas";

interface RunConfig {
  rounds: number;
  endowment: number;
  persona_mix: { proposer: ProposerPersona; responder: ResponderPersona };
  seed: number;
  model_spec?: string;
  visibility?: "private" | "unlisted" | "public";
}

async function insertMessage(
  sql: postgres.Sql,
  args: {
    runId: string;
    roundNumber: number | null;
    agentRole: "researcher" | "proposer" | "responder";
    fromAgent: string;
    content: string;
    eventType: string;
    payload?: Record<string, unknown>;
  },
) {
  // postgres.js's template-tag type inference chokes on unions with objects;
  // hand-roll the JSON serialization so every bound parameter is a scalar.
  const payloadJson = args.payload == null ? null : JSON.stringify(args.payload);
  await sql`
    insert into messages (run_id, round_number, agent_role, from_agent, content, event_type, payload)
    values (${args.runId}, ${args.roundNumber}, ${args.agentRole}, ${args.fromAgent},
            ${args.content}, ${args.eventType}, ${payloadJson}::jsonb)
  `;
}

async function fundAgent(opts: {
  env: ReturnType<typeof loadEnv>;
  wallet: Address;
  usdcAmount: bigint;
}) {
  const { env, wallet, usdcAmount } = opts;
  const funder = walletClient(env.RPC_URL, env.AGENT_FUNDER_KEY as Hex);
  const pc = publicClient(env.RPC_URL);

  // 0.01 ETH for gas — plenty on anvil, negligible on Base Sepolia.
  const ethTx = await funder.sendTransaction({
    to: wallet,
    value: 10_000_000_000_000_000n, // 0.01 ETH
  });
  await pc.waitForTransactionReceipt({ hash: ethTx });

  // Mint MockUSDC directly. On anvil the funder calls mint(); on real Base
  // Sepolia you'd transfer from a pre-funded account instead.
  const mintTx = await funder.writeContract({
    address: env.USDC_ADDRESS as Address,
    abi: [
      {
        type: "function",
        name: "mint",
        stateMutability: "nonpayable",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [],
      },
    ] as const,
    functionName: "mint",
    args: [wallet, usdcAmount],
  });
  await pc.waitForTransactionReceipt({ hash: mintTx });
}

async function registerInRegistry(opts: {
  env: ReturnType<typeof loadEnv>;
  agentKey: Hex;
  meta: Record<string, unknown>;
}) {
  const { env, agentKey, meta } = opts;
  const hash = metadataHash(JSON.stringify(meta));
  const { agentId, txHash } = await registerAgent({
    rpcUrl: env.RPC_URL,
    registry: env.AGENT_REGISTRY_ADDRESS as Address,
    signerKey: agentKey,
    metadataHash: hash,
  });
  return { agentId, txHash, metadataHash: hash };
}

async function usdcBalance(env: ReturnType<typeof loadEnv>, owner: Address): Promise<bigint> {
  const pc = publicClient(env.RPC_URL);
  return pc.readContract({
    address: env.USDC_ADDRESS as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
}

export async function runGame(runId: string) {
  const env = loadEnv();
  const sql = postgres(env.DATABASE_URL, { prepare: false, max: 5 });
  const db = drizzle(sql, { schema });

  try {
    const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, runId));
    if (!run) throw new Error(`run ${runId} not found`);

    const cfg = run.configSnapshot as unknown as RunConfig;
    const rng = mulberry32(cfg.seed ?? 1);
    logger.info({ runId, cfg }, "runGame: starting");

    await db.update(schema.runs).set({ status: "running", startedAt: new Date() }).where(eq(schema.runs.id, runId));

    // --- Step 1: mint ephemeral wallets, fund, register on-chain ---
    const proposerKey = generatePrivateKey();
    const responderKey = generatePrivateKey();
    const proposerAccount = privateKeyToAccount(proposerKey);
    const responderAccount = privateKeyToAccount(responderKey);

    await insertMessage(sql, {
      runId,
      roundNumber: null,
      agentRole: "researcher",
      fromAgent: "researcher",
      content: `Game start. Endowment ${cfg.endowment} USDC, ${cfg.rounds} rounds. Proposer persona: ${cfg.persona_mix.proposer}. Responder persona: ${cfg.persona_mix.responder}.`,
      eventType: "game_start",
      payload: {
        endowment: cfg.endowment,
        rounds: cfg.rounds,
        persona_mix: cfg.persona_mix,
        proposer_wallet: proposerAccount.address,
        responder_wallet: responderAccount.address,
      },
    });

    // Each proposer receives `endowment * rounds` USDC up front; agreeing
    // rounds drain that balance by the offered amount.
    const endowmentUsdc = BigInt(cfg.endowment) * BigInt(cfg.rounds) * 10n ** 6n;
    await fundAgent({ env, wallet: proposerAccount.address, usdcAmount: endowmentUsdc });
    // Responder needs only gas; starts with 0 USDC and earns from agreements.
    await fundAgent({ env, wallet: responderAccount.address, usdcAmount: 0n });

    await insertMessage(sql, {
      runId,
      roundNumber: null,
      agentRole: "researcher",
      fromAgent: "researcher",
      content: `Wallets minted and funded. Proposer holds ${cfg.endowment * cfg.rounds} USDC; responder holds 0.`,
      eventType: "funded",
      payload: {
        proposer: { address: proposerAccount.address, usdc: cfg.endowment * cfg.rounds },
        responder: { address: responderAccount.address, usdc: 0 },
      },
    });

    const proposerReg = await registerInRegistry({
      env,
      agentKey: proposerKey,
      meta: { role: "proposer", persona: cfg.persona_mix.proposer, runId },
    });
    const responderReg = await registerInRegistry({
      env,
      agentKey: responderKey,
      meta: { role: "responder", persona: cfg.persona_mix.responder, runId },
    });

    await db.insert(schema.agentInstances).values([
      {
        runId,
        role: "proposer",
        persona: cfg.persona_mix.proposer,
        walletAddress: proposerAccount.address,
        erc8004AgentId: proposerReg.agentId,
      },
      {
        runId,
        role: "responder",
        persona: cfg.persona_mix.responder,
        walletAddress: responderAccount.address,
        erc8004AgentId: responderReg.agentId,
      },
    ]);

    await insertMessage(sql, {
      runId,
      roundNumber: null,
      agentRole: "researcher",
      fromAgent: "researcher",
      content: `ERC-8004 registrations complete. Proposer agentId=${proposerReg.agentId}, responder agentId=${responderReg.agentId}.`,
      eventType: "registered",
      payload: {
        proposer: { agentId: proposerReg.agentId.toString(), tx: proposerReg.txHash },
        responder: { agentId: responderReg.agentId.toString(), tx: responderReg.txHash },
      },
    });

    // --- Step 2: play rounds ---
    const perRoundEvents: Array<{
      round: number;
      offer: number;
      accepted: boolean;
      proposerScore: number;
      responderScore: number;
      transferTx: Hex | undefined;
    }> = [];

    for (let round = 1; round <= cfg.rounds; round++) {
      await db.insert(schema.rounds).values({ runId, roundNumber: round });

      const offerDecision = proposerOffer(cfg.persona_mix.proposer, cfg.endowment, round, rng);
      const offer = offerDecision.offer;
      await insertMessage(sql, {
        runId,
        roundNumber: round,
        agentRole: "proposer",
        fromAgent: `proposer[${cfg.persona_mix.proposer}]`,
        content: `I offer ${offer} of ${cfg.endowment} USDC. ${offerDecision.rationale}`,
        eventType: "offer",
        payload: { amount: offer, endowment: cfg.endowment, rationale: offerDecision.rationale },
      });

      const response = responderDecision(cfg.persona_mix.responder, offer, cfg.endowment, round, rng);
      await insertMessage(sql, {
        runId,
        roundNumber: round,
        agentRole: "responder",
        fromAgent: `responder[${cfg.persona_mix.responder}]`,
        content: `${response.accept ? "ACCEPTED" : "REJECTED"}. ${response.rationale}`,
        eventType: "response",
        payload: { accepted: response.accept, rationale: response.rationale },
      });

      let transferTx: Hex | undefined;
      if (response.accept && offer > 0) {
        const amountHuman = String(offer);
        const tx = await sendUsdc({
          rpcUrl: env.RPC_URL,
          usdc: env.USDC_ADDRESS as Address,
          senderKey: proposerKey,
          to: responderAccount.address,
          amountHuman,
        });
        transferTx = tx.txHash;
        await insertMessage(sql, {
          runId,
          roundNumber: round,
          agentRole: "researcher",
          fromAgent: "researcher",
          content: `Round ${round} settled: ${amountHuman} USDC transferred on-chain.`,
          eventType: "transfer",
          payload: {
            amount: offer,
            tx: transferTx,
            from: proposerAccount.address,
            to: responderAccount.address,
            blockNumber: tx.blockNumber.toString(),
          },
        });
      } else {
        await insertMessage(sql, {
          runId,
          roundNumber: round,
          agentRole: "researcher",
          fromAgent: "researcher",
          content: `Round ${round} settled: both earn 0 (${response.accept ? "zero offer" : "rejected"}).`,
          eventType: "verdict",
          payload: { accepted: response.accept, offer, both: 0 },
        });
      }

      const proposerGrade = grade(cfg.persona_mix.proposer, {
        offer,
        endowment: cfg.endowment,
        accepted: response.accept,
        perspective: "proposer",
      });
      const responderGrade = grade(cfg.persona_mix.responder, {
        offer,
        endowment: cfg.endowment,
        accepted: response.accept,
        perspective: "responder",
      });
      await insertMessage(sql, {
        runId,
        roundNumber: round,
        agentRole: "researcher",
        fromAgent: "researcher",
        content: `Round ${round} grades: proposer→responder=${proposerGrade.score} (${proposerGrade.rationale}); responder→proposer=${responderGrade.score} (${responderGrade.rationale}).`,
        eventType: "grade",
        payload: {
          proposer_to_responder: proposerGrade,
          responder_to_proposer: responderGrade,
        },
      });

      perRoundEvents.push({
        round,
        offer,
        accepted: response.accept,
        proposerScore: proposerGrade.score,
        responderScore: responderGrade.score,
        transferTx,
      });

      await db
        .update(schema.rounds)
        .set({
          offerAmount: String(offer),
          response: response.accept ? "accepted" : "rejected",
          verdict: response.accept ? "settled" : "both-zero",
          completedAt: new Date(),
        })
        .where(eq(schema.rounds.runId, runId));
    }

    // --- Step 3: batch reputation submission ---
    const runIdBytes32 = keccak256(toHex(runId)) as Hex;
    const dimFairness = dimensionKey("fairness");
    const dimCooperation = dimensionKey("cooperation");

    const batch: SignedFeedback[] = [];
    // Nonces start at 0 for each freshly-registered wallet.
    let proposerNonce = 0n;
    let responderNonce = 0n;
    for (const r of perRoundEvents) {
      batch.push(
        await signFeedback({
          repRegistry: env.REPUTATION_REGISTRY_ADDRESS as Address,
          agentKey: proposerKey,
          feedback: {
            fromAgentId: proposerReg.agentId,
            toAgentId: responderReg.agentId,
            runId: runIdBytes32,
            dimension: dimCooperation,
            score: r.proposerScore,
            nonce: proposerNonce++,
          },
        }),
      );
      batch.push(
        await signFeedback({
          repRegistry: env.REPUTATION_REGISTRY_ADDRESS as Address,
          agentKey: responderKey,
          feedback: {
            fromAgentId: responderReg.agentId,
            toAgentId: proposerReg.agentId,
            runId: runIdBytes32,
            dimension: dimFairness,
            score: r.responderScore,
            nonce: responderNonce++,
          },
        }),
      );
    }

    const repTx = await submitFeedbackBatch({
      rpcUrl: env.RPC_URL,
      repRegistry: env.REPUTATION_REGISTRY_ADDRESS as Address,
      platformSignerKey: env.PLATFORM_SIGNER_KEY as Hex,
      batch,
    });

    const pc = publicClient(env.RPC_URL);
    const receipt = await pc.waitForTransactionReceipt({ hash: repTx });

    // Record confirmed reputation events in Postgres as a read cache.
    const repRows = perRoundEvents.flatMap((r) => [
      {
        runId,
        fromAgentId: proposerReg.agentId,
        toAgentId: responderReg.agentId,
        dimension: "cooperation",
        score: r.proposerScore,
        status: "confirmed" as const,
        onchainTxHash: repTx,
        blockNumber: receipt.blockNumber,
        confirmedAt: new Date(),
      },
      {
        runId,
        fromAgentId: responderReg.agentId,
        toAgentId: proposerReg.agentId,
        dimension: "fairness",
        score: r.responderScore,
        status: "confirmed" as const,
        onchainTxHash: repTx,
        blockNumber: receipt.blockNumber,
        confirmedAt: new Date(),
      },
    ]);
    await db.insert(schema.reputationEvents).values(repRows);

    await insertMessage(sql, {
      runId,
      roundNumber: null,
      agentRole: "researcher",
      fromAgent: "researcher",
      content: `Reputation batch confirmed on-chain (${batch.length} feedbacks) at tx ${repTx}.`,
      eventType: "reputation_confirmed",
      payload: {
        tx: repTx,
        blockNumber: receipt.blockNumber.toString(),
        feedbackCount: batch.length,
      },
    });

    // --- Step 4: final summary ---
    const finalProposerUsdc = await usdcBalance(env, proposerAccount.address);
    const finalResponderUsdc = await usdcBalance(env, responderAccount.address);

    await insertMessage(sql, {
      runId,
      roundNumber: null,
      agentRole: "researcher",
      fromAgent: "researcher",
      content: `Run complete. Final balances: proposer ${formatUnits(finalProposerUsdc, 6)} USDC; responder ${formatUnits(finalResponderUsdc, 6)} USDC.`,
      eventType: "run_complete",
      payload: {
        proposer_usdc: formatUnits(finalProposerUsdc, 6),
        responder_usdc: formatUnits(finalResponderUsdc, 6),
        rounds: perRoundEvents,
      },
    });

    await db
      .update(schema.runs)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(schema.runs.id, runId));

    logger.info({ runId, repTx }, "runGame: completed");
    return {
      runId,
      proposer: { address: proposerAccount.address, agentId: proposerReg.agentId.toString() },
      responder: { address: responderAccount.address, agentId: responderReg.agentId.toString() },
      reputationTx: repTx,
      rounds: perRoundEvents,
    };
  } catch (err) {
    logger.error({ err, runId }, "runGame failed");
    await sql`update runs set status = 'failed', error = ${String((err as Error).message ?? err)} where id = ${runId}`;
    throw err;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function getOrCreateDemoRun(): Promise<string> {
  const env = loadEnv();
  const sql = postgres(env.DATABASE_URL, { prepare: false, max: 2 });
  try {
    const [exp] = await sql<{ id: string; config: unknown }[]>`
      select e.id, e.config
      from experiments e
      join orgs o on o.id = e.org_id
      where o.slug = 'demo'
      order by e.created_at
      limit 1
    `;
    if (!exp) throw new Error("no demo experiment seeded");

    const slug = `e2e-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
    const rows = await sql<{ id: string }[]>`
      insert into runs (experiment_id, org_id, public_slug, status, visibility, config_snapshot)
      select e.id, e.org_id, ${slug}, 'queued', 'public', e.config
      from experiments e
      where e.id = ${exp.id}
      returning id
    `;
    const run = rows[0];
    if (!run) throw new Error("failed to create demo run");
    logger.info({ runId: run.id, slug }, "demo run created");
    return run.id;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// CLI: `tsx src/run-game.ts [runId]`
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  (async () => {
    const runId = process.argv[2] ?? (await getOrCreateDemoRun());
    const result = await runGame(runId);
    console.log(JSON.stringify({ ok: true, ...result, reputationTx: result.reputationTx }, null, 2));
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

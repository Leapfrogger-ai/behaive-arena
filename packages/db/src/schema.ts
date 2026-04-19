import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    userId: uuid("user_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
    expiresIdx: index("sessions_expires_idx").on(t.expiresAt),
  }),
);

export const orgRole = pgEnum("org_role", ["owner", "admin", "member"]);
export const runStatus = pgEnum("run_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export const runVisibility = pgEnum("run_visibility", [
  "private",
  "unlisted",
  "public",
]);
export const agentRole = pgEnum("agent_role", [
  "researcher",
  "proposer",
  "responder",
]);
export const reputationStatus = pgEnum("reputation_status", [
  "pending",
  "confirmed",
  "failed",
]);
export const provider = pgEnum("provider", [
  "anthropic",
  "openai",
  "google",
  "mock",
  "custom",
]);

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: orgRole("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.orgId, t.userId] }),
    userIdx: index("org_members_user_idx").on(t.userId),
  }),
);

export const experiments = pgTable(
  "experiments",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    orgId: uuid("org_id").notNull(),
    createdBy: uuid("created_by").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    config: jsonb("config").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ orgIdx: index("experiments_org_idx").on(t.orgId) }),
);

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    experimentId: uuid("experiment_id").notNull(),
    orgId: uuid("org_id").notNull(),
    publicSlug: text("public_slug").notNull().unique(),
    status: runStatus("status").notNull().default("queued"),
    visibility: runVisibility("visibility").notNull().default("private"),
    configSnapshot: jsonb("config_snapshot").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    experimentIdx: index("runs_experiment_idx").on(t.experimentId),
    orgIdx: index("runs_org_idx").on(t.orgId),
    statusIdx: index("runs_status_idx").on(t.status),
  }),
);

export const agentInstances = pgTable(
  "agent_instances",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    runId: uuid("run_id").notNull(),
    role: agentRole("role").notNull(),
    persona: text("persona").notNull(),
    walletAddress: text("wallet_address").notNull(),
    walletKeyCiphertext: bytea("wallet_key_ciphertext"),
    erc8004AgentId: bigint("erc8004_agent_id", { mode: "bigint" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ runIdx: index("agent_instances_run_idx").on(t.runId) }),
);

export const rounds = pgTable(
  "rounds",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    runId: uuid("run_id").notNull(),
    roundNumber: integer("round_number").notNull(),
    offerAmount: numeric("offer_amount"),
    response: text("response"),
    verdict: text("verdict"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    runIdx: index("rounds_run_idx").on(t.runId),
    runRoundUq: uniqueIndex("rounds_run_round_uq").on(t.runId, t.roundNumber),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    runId: uuid("run_id").notNull(),
    roundNumber: integer("round_number"),
    agentRole: agentRole("agent_role").notNull(),
    fromAgent: text("from_agent").notNull(),
    content: text("content").notNull(),
    eventType: text("event_type").notNull().default("chat"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runCreatedIdx: index("messages_run_created_idx").on(t.runId, t.createdAt),
    runRoundIdx: index("messages_run_round_idx").on(t.runId, t.roundNumber),
  }),
);

export const reputationEvents = pgTable(
  "reputation_events",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    runId: uuid("run_id").notNull(),
    fromAgentId: bigint("from_agent_id", { mode: "bigint" }).notNull(),
    toAgentId: bigint("to_agent_id", { mode: "bigint" }).notNull(),
    dimension: text("dimension").notNull(),
    score: smallint("score").notNull(),
    status: reputationStatus("status").notNull().default("pending"),
    onchainTxHash: text("onchain_tx_hash"),
    blockNumber: bigint("block_number", { mode: "bigint" }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => ({
    runIdx: index("reputation_run_idx").on(t.runId),
    statusIdx: index("reputation_status_idx").on(t.status),
  }),
);

export const byoKeys = pgTable(
  "byo_keys",
  {
    id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
    orgId: uuid("org_id").notNull(),
    createdBy: uuid("created_by").notNull(),
    provider: provider("provider").notNull(),
    label: text("label").notNull(),
    keyCiphertext: bytea("key_ciphertext").notNull(),
    keyFingerprint: text("key_fingerprint").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("byo_keys_org_idx").on(t.orgId),
    orgLabelUq: uniqueIndex("byo_keys_org_label_uq").on(t.orgId, t.label),
  }),
);

export const exports = pgTable("exports", {
  id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  runId: uuid("run_id").notNull(),
  format: text("format").notNull(),
  storagePath: text("storage_path").notNull(),
  byteSize: bigint("byte_size", { mode: "bigint" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

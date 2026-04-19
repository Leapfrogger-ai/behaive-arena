import { z } from "zod";

const HexKey = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be 0x-prefixed 32-byte hex");
const HexAddr = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-prefixed address");

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  RPC_URL: z.string().url(),
  CHAIN_ID: z.coerce.number().int().default(31337),

  PLATFORM_SIGNER_KEY: HexKey,
  AGENT_FUNDER_KEY: HexKey,

  AGENT_REGISTRY_ADDRESS: HexAddr,
  REPUTATION_REGISTRY_ADDRESS: HexAddr,
  USDC_ADDRESS: HexAddr,

  MODEL_PROVIDER: z.enum(["mock", "anthropic", "openai", "google"]).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid worker environment: ${msg}`);
  }
  return parsed.data;
}

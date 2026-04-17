import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    // Paths to redact in every log line. Defense against accidentally logging
    // BYO keys, wallet keys, service-role tokens, or EIP-712 signatures.
    paths: [
      "*.SUPABASE_SERVICE_ROLE_KEY",
      "*.PLATFORM_SIGNER_KEY",
      "*.senderKey",
      "*.agentKey",
      "*.walletKey",
      "*.apiKey",
      "*.signature",
      "payload.signature",
    ],
    censor: "[REDACTED]",
  },
});

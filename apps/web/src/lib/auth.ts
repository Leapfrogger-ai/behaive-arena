import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { schema } from "@behaive/db";
import { db } from "./db";
import { serverEnv } from "./env";

const COOKIE_NAME = "behaive_session";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHmac("sha256", serverEnv().SESSION_SECRET).update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS);
  await db().insert(schema.sessions).values({ userId, tokenHash, expiresAt });
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: process.env.NODE_ENV === "production",
  });
  return { token, expiresAt };
}

export async function getSessionUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const tokenHash = hashToken(token);
  const [row] = await db()
    .select({ userId: schema.sessions.userId, expiresAt: schema.sessions.expiresAt })
    .from(schema.sessions)
    .where(eq(schema.sessions.tokenHash, tokenHash));
  if (!row || row.expiresAt < new Date()) return null;
  const [user] = await db().select().from(schema.users).where(eq(schema.users.id, row.userId));
  return user ?? null;
}

// Dev-only sign-in as the seeded demo researcher. Landing page links to
// this so the e2e flow doesn't require email provisioning. Production
// builds should gate this behind a feature flag or strip it entirely.
export async function devSignInAsDemo() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("dev sign-in is disabled in production");
  }
  const [user] = await db().select().from(schema.users).where(eq(schema.users.email, "demo@behaive.local"));
  if (!user) throw new Error("demo user not seeded — run packages/db/migrations/0002_seed_demo.sql");
  await createSession(user.id);
  return user;
}

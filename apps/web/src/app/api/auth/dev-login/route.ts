import { NextResponse } from "next/server";
import { devSignInAsDemo } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Development-only one-click sign-in as the seeded demo user. Creates a
// session cookie and redirects home. Not exposed in production.
export async function GET() {
  const user = await devSignInAsDemo();
  const resp = NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000"),
  );
  return resp;
  // `user` is unused here; kept as the explicit result of session creation
  // so future audits can see what we authenticated as.
  void user;
}

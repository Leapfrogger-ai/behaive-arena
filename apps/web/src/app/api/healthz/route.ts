import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Supabase free tier pauses a project after 7 days of inactivity.
// A GitHub Actions cron pings this endpoint every 3 days to keep the
// project warm; the endpoint touches Postgres so the DB connection pool
// sees activity as well.
export async function GET() {
  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
  });
}

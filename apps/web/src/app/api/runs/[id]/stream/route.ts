import { asc, eq, gt } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { schema } from "@behaive/db";
import { db, listener } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSE stream backed by Postgres LISTEN/NOTIFY. Each subscriber opens a
// dedicated Postgres connection (listener()) and subscribes to the
// `run:<id>` channel the migration's insert trigger notifies on. Any
// messages written to the DB after the caller's ?since=<id> are replayed
// in order so reconnects don't drop history.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const [run] = await db()
    .select({ id: schema.runs.id, visibility: schema.runs.visibility })
    .from(schema.runs)
    .where(eq(schema.runs.id, params.id));

  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (run.visibility !== "public" && run.visibility !== "unlisted") {
    return NextResponse.json({ error: "private" }, { status: 403 });
  }

  const since = Number(
    req.nextUrl.searchParams.get("since") ?? req.headers.get("last-event-id") ?? "0",
  );

  const encoder = new TextEncoder();
  const channel = `run:${params.id}`;
  const sub = listener();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (id: number | string, event: string, data: unknown) => {
        if (closed) return;
        const line =
          `id: ${id}\n` + `event: ${event}\n` + `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(line));
      };

      // Replay any rows the client hasn't seen yet.
      const backlog = await db()
        .select()
        .from(schema.messages)
        .where(and(eq(schema.messages.runId, params.id), gt(schema.messages.id, BigInt(Number.isFinite(since) ? since : 0))))
        .orderBy(asc(schema.messages.id))
        .limit(500);
      for (const m of backlog) {
        send(Number(m.id), m.eventType ?? "message", {
          id: Number(m.id),
          run_id: m.runId,
          round_number: m.roundNumber,
          agent_role: m.agentRole,
          from_agent: m.fromAgent,
          content: m.content,
          event_type: m.eventType,
          payload: m.payload,
          created_at: m.createdAt.toISOString(),
        });
      }

      await sub.listen(channel, (payload) => {
        try {
          const parsed = JSON.parse(payload) as {
            id: number | string;
            event_type?: string;
          };
          send(parsed.id, parsed.event_type ?? "message", parsed);
        } catch {
          send("raw", "message", payload);
        }
      });

      // Keepalive — SSE proxies drop silent connections after ~60s.
      const ping = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 15_000);

      req.signal.addEventListener("abort", async () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        try {
          await sub.end({ timeout: 1 });
        } catch {
          /* ignore */
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

// Tiny helper — Drizzle's `and` is only imported where needed, so we keep
// it local to this module to avoid a circular import.
import { and } from "drizzle-orm";

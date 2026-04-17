import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAnon } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-Sent Events fallback for clients that can't open a Supabase
// Realtime websocket. Streams the same INSERTs via Postgres LISTEN/NOTIFY
// mediated by Supabase Realtime over a long-lived fetch on the server.
//
// Reconnection: honors the Last-Event-ID header — the event id is the
// message primary key, so the client can pick up where it left off.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createSupabaseAnon();
  const { data: run } = await sb
    .from("runs")
    .select("id, visibility")
    .eq("id", params.id)
    .in("visibility", ["public", "unlisted"])
    .maybeSingle();
  if (!run) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const lastEventId = Number(req.headers.get("last-event-id") ?? "0");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: { id: number; event: string; data: unknown }) => {
        const line =
          `id: ${payload.id}\n` +
          `event: ${payload.event}\n` +
          `data: ${JSON.stringify(payload.data)}\n\n`;
        controller.enqueue(encoder.encode(line));
      };

      // Replay any messages newer than the client's Last-Event-ID so a
      // reconnection fills the gap without depending on the realtime buffer.
      const { data: backlog } = await sb
        .from("messages")
        .select("id, round_number, agent_role, from_agent, content, event_type, payload, created_at")
        .eq("run_id", params.id)
        .gt("id", lastEventId)
        .order("id", { ascending: true })
        .limit(500);
      for (const m of backlog ?? []) {
        send({ id: Number(m.id), event: m.event_type ?? "message", data: m });
      }

      const channel = sb
        .channel(`sse:run:${params.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `run_id=eq.${params.id}`,
          },
          (payload) => {
            const m = payload.new as {
              id: number;
              event_type: string;
              [k: string]: unknown;
            };
            send({ id: m.id, event: m.event_type ?? "message", data: m });
          },
        )
        .subscribe();

      // Keepalive comment every 15s so proxies don't drop the connection.
      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 15_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        sb.removeChannel(channel);
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

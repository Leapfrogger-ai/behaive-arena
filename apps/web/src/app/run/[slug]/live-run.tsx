"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface Message {
  id: number | string;
  round_number: number | null;
  agent_role: "researcher" | "proposer" | "responder";
  from_agent: string;
  content: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export function LiveRun(props: {
  runId: string;
  initialMessages: Message[];
  initialStatus: string;
}) {
  const [messages, setMessages] = useState<Message[]>(props.initialMessages);
  const [status, setStatus] = useState(props.initialStatus);
  const seen = useRef(new Set<string>(props.initialMessages.map((m) => String(m.id))));

  useEffect(() => {
    const sb = getSupabaseBrowser();
    const channel = sb
      .channel(`run:${props.runId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `run_id=eq.${props.runId}` },
        (payload) => {
          const msg = payload.new as Message;
          const key = String(msg.id);
          if (seen.current.has(key)) return;
          seen.current.add(key);
          setMessages((cur) => [...cur, msg]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "runs", filter: `id=eq.${props.runId}` },
        (payload) => {
          const next = payload.new as { status: string };
          setStatus(next.status);
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [props.runId]);

  const byRound = useMemo(() => {
    return messages.reduce<Record<string, Message[]>>((acc, m) => {
      const key = m.round_number != null ? `Round ${m.round_number}` : "Setup";
      (acc[key] ??= []).push(m);
      return acc;
    }, {});
  }, [messages]);

  return (
    <section>
      <p className="muted">live status: {status}</p>
      {Object.entries(byRound).map(([label, list]) => (
        <div key={label} className="card">
          <h3>{label}</h3>
          {list.map((m) => (
            <div key={String(m.id)} style={{ marginBottom: 8 }}>
              <span className={`role ${m.agent_role}`}>{m.agent_role}</span>
              <span>{m.content}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

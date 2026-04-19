"use client";
import { useEffect, useMemo, useRef, useState } from "react";

interface Message {
  id: number;
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
  const seen = useRef(new Set<number>(props.initialMessages.map((m) => m.id)));

  useEffect(() => {
    const lastSeen = props.initialMessages.reduce((m, cur) => Math.max(m, cur.id), 0);
    const src = new EventSource(`/api/runs/${props.runId}/stream?since=${lastSeen}`);

    const handleMessage = (ev: MessageEvent<string>) => {
      let msg: Message;
      try {
        msg = JSON.parse(ev.data) as Message;
      } catch {
        return;
      }
      if (seen.current.has(msg.id)) return;
      seen.current.add(msg.id);
      setMessages((cur) => [...cur, msg]);
    };
    const handleStatus = (ev: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(ev.data) as { content: string };
        setStatus(parsed.content);
      } catch {
        /* no-op */
      }
    };

    src.addEventListener("message", handleMessage);
    src.addEventListener("game_start", handleMessage);
    src.addEventListener("offer", handleMessage);
    src.addEventListener("response", handleMessage);
    src.addEventListener("transfer", handleMessage);
    src.addEventListener("verdict", handleMessage);
    src.addEventListener("grade", handleMessage);
    src.addEventListener("registered", handleMessage);
    src.addEventListener("funded", handleMessage);
    src.addEventListener("reputation_confirmed", handleMessage);
    src.addEventListener("run_complete", handleMessage);
    src.addEventListener("run_status", handleStatus);
    src.addEventListener("chat", handleMessage);

    return () => src.close();
  }, [props.runId, props.initialMessages]);

  const byRound = useMemo(() => {
    const acc = new Map<string, Message[]>();
    for (const m of messages) {
      const key = m.round_number != null ? `Round ${m.round_number}` : "Setup / results";
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)!.push(m);
    }
    return acc;
  }, [messages]);

  return (
    <section>
      <p className="muted">live status: {status}</p>
      {Array.from(byRound.entries()).map(([label, list]) => (
        <div key={label} className="card">
          <h3>{label}</h3>
          {list.map((m) => (
            <div key={m.id} style={{ marginBottom: 8 }}>
              <span className={`role ${m.agent_role}`}>{m.agent_role}</span>
              <span>
                <strong style={{ opacity: 0.7, marginRight: 8 }}>{m.event_type}</strong>
                {m.content}
              </span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

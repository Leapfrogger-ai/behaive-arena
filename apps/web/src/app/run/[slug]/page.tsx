import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { schema } from "@behaive/db";
import { db } from "@/lib/db";
import { LiveRun } from "./live-run";

interface Params {
  params: { slug: string };
}

export const dynamic = "force-dynamic";

export default async function PublicRunPage({ params }: Params) {
  const [run] = await db()
    .select()
    .from(schema.runs)
    .where(
      and(
        eq(schema.runs.publicSlug, params.slug),
        inArray(schema.runs.visibility, ["public", "unlisted"]),
      ),
    );

  if (!run) notFound();

  const initialMessages = await db()
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.runId, run.id))
    .orderBy(asc(schema.messages.id))
    .limit(500);

  return (
    <main>
      <h1>Run {run.publicSlug}</h1>
      <p className="muted">
        status: <strong>{run.status}</strong>
        {run.startedAt ? ` • started ${new Date(run.startedAt).toLocaleString()}` : ""}
      </p>
      <LiveRun
        runId={run.id}
        initialMessages={initialMessages.map((m) => ({
          ...m,
          id: Number(m.id),
          payload: (m.payload as Record<string, unknown> | null) ?? null,
          created_at: m.createdAt.toISOString(),
          agent_role: m.agentRole,
          from_agent: m.fromAgent,
          round_number: m.roundNumber,
          event_type: m.eventType,
        }))}
        initialStatus={run.status}
      />
    </main>
  );
}

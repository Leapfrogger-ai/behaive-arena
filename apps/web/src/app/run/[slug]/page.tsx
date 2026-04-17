import { notFound } from "next/navigation";
import { createSupabaseAnon } from "@/lib/supabase/server";
import { LiveRun } from "./live-run";

interface Params {
  params: { slug: string };
}

export const dynamic = "force-dynamic";

export default async function PublicRunPage({ params }: Params) {
  const sb = createSupabaseAnon();
  const { data: run } = await sb
    .from("runs")
    .select("id, public_slug, status, visibility, started_at, completed_at, config_snapshot")
    .eq("public_slug", params.slug)
    .in("visibility", ["public", "unlisted"])
    .maybeSingle();

  if (!run) notFound();

  const { data: initialMessages } = await sb
    .from("messages")
    .select("id, round_number, agent_role, from_agent, content, event_type, payload, created_at")
    .eq("run_id", run.id)
    .order("created_at", { ascending: true })
    .limit(500);

  return (
    <main>
      <h1>Run {run.public_slug}</h1>
      <p className="muted">
        status: <strong>{run.status}</strong>
        {run.started_at ? ` • started ${new Date(run.started_at).toLocaleString()}` : ""}
      </p>
      <LiveRun
        runId={run.id}
        initialMessages={initialMessages ?? []}
        initialStatus={run.status}
      />
    </main>
  );
}

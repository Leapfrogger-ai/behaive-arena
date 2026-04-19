import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { schema } from "@behaive/db";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const visible = await db()
    .select({
      id: schema.runs.id,
      slug: schema.runs.publicSlug,
      status: schema.runs.status,
      created: schema.runs.createdAt,
      visibility: schema.runs.visibility,
    })
    .from(schema.runs)
    .where(inArray(schema.runs.visibility, ["public", "unlisted"]))
    .orderBy(desc(schema.runs.createdAt))
    .limit(10);

  return (
    <main>
      <h1>Behaive Arena</h1>
      <p className="muted">
        Hosted research platform for on-chain behavioral-economics experiments with AI agents.
      </p>
      <div className="card">
        <h3>Recent public runs</h3>
        {visible.length === 0 ? (
          <p className="muted">
            No runs yet. Start one with <code>pnpm --filter @behaive/worker run-game</code>.
          </p>
        ) : (
          <ul>
            {visible.map((r) => (
              <li key={r.id}>
                <Link href={`/run/${r.slug}`}>
                  <strong>{r.slug}</strong>
                </Link>{" "}
                <span className="muted">— {r.status} — {new Date(r.created).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="muted">
        Dev auto-login: <Link href="/api/auth/dev-login">sign in as demo researcher</Link>
      </p>
    </main>
  );
}

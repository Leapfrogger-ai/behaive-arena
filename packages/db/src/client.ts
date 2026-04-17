import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createClient>;

// The worker uses the Supabase service-role connection string. The web app
// prefers PostgREST / the supabase-js client so RLS is enforced against the
// authenticated user — but server-side admin flows can use this too.
export function createClient(connectionString: string) {
  const client = postgres(connectionString, {
    prepare: false,
    max: 5,
  });
  return drizzle(client, { schema });
}

export { schema };

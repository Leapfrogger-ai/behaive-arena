import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./env.js";

// Service-role client — bypasses RLS. Only used server-side in the worker.
// Never expose this key to the browser or to any code path a user can call
// directly without authorization checks.
export function createServiceClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

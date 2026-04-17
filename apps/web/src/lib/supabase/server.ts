import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv, serverEnv } from "../env";

// Auth-aware server client for Route Handlers / Server Components. Uses
// cookie-based sessions so RLS queries run as the logged-in user.
export function createSupabaseServer() {
  const env = publicEnv();
  const store = cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get: (name: string) => store.get(name)?.value,
      set: (name: string, value: string, options: CookieOptions) => {
        try {
          store.set({ name, value, ...options });
        } catch {
          // Server Components can't mutate cookies; rely on middleware.
        }
      },
      remove: (name: string, options: CookieOptions) => {
        try {
          store.set({ name, value: "", ...options });
        } catch {
          // Same caveat as above.
        }
      },
    },
  });
}

// Anonymous client for public run pages — no cookies, no session, relies
// purely on RLS `visibility in ('public', 'unlisted')` policies.
export function createSupabaseAnon() {
  const env = publicEnv();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { get: () => undefined, set: () => {}, remove: () => {} },
  });
}

// Service-role client — bypasses RLS. NEVER expose to the browser. Only
// use behind server-only code paths that have already authorized the caller.
export function createSupabaseService() {
  const env = serverEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for service-role access");
  }
  // Re-use createServerClient with a sentinel cookies adapter; the service
  // role key + { persistSession: false } is the safe incantation.
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    cookies: { get: () => undefined, set: () => {}, remove: () => {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

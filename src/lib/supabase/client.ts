import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-safe Supabase client using only public anon credentials.
 * Never uses service role or secret keys.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes("your-project-id")) {
    return null;
  }

  return createBrowserClient(url, anonKey);
}

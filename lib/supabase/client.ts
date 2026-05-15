"use client";

import { createBrowserClient } from "@supabase/ssr";

const fallbackUrl = "https://example.supabase.co";
const fallbackAnon =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJwb2NrZXRtYW5hZ2VyIiwiZXhwIjoyNTM0MDI0NTQxLCJzdWIiOiJwdWJsaWMifQ.XlE6hbYeQYWm0o-Z-9Dd2rND8KE7zfWXJ6w2YvP4t7A";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? fallbackUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fallbackAnon,
);

export const isSupabaseConfigured =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

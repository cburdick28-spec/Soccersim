import { createClient } from "@supabase/supabase-js";

const fallbackSupabaseUrl = "https://zxzmsslbjhtyvdllbkjo.supabase.co";
const fallbackSupabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4em1zc2xiamh0eXZkbGxia2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjQwNTUsImV4cCI6MjA5NDQwMDA1NX0.DvC2zQrgVbPEVAXGIccHYVlEPvCRfgY7AWf00AGndSk";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fallbackSupabaseUrl;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fallbackSupabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

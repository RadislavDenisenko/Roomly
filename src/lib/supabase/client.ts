import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// True only when real Supabase keys are present (not the placeholders in SETUP.md).
export const supabaseConfigured =
  supabaseUrl.length > 0 &&
  supabaseAnonKey.length > 0 &&
  !supabaseUrl.includes("your-project") &&
  !supabaseAnonKey.includes("your-anon");

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

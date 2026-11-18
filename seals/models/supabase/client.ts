import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type BoardSupabaseClient = SupabaseClient<Database>;
let browserClient: BoardSupabaseClient | undefined;

/** Call from the browser after opting into cloud features. No client is created on import. */
export function getSupabaseBrowserClient(): BoardSupabaseClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;
    browserClient ??= createClient<Database>(url, key);
    return browserClient;
}

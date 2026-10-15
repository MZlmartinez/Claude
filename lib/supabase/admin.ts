import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente de servidor con la service_role key — ignora RLS a propósito.
// Solo lo usan jobs de backend (el sync de Fabric), nunca código que
// corra en el navegador del cliente.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

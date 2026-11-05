import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | undefined

/** Uma única instância mantém a sessão sincronizada entre todas as telas. */
export function getSupabase(): SupabaseClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !key) throw new Error("Configure o Supabase no arquivo frontend/.env.local.")
  if (!url.startsWith("https://") || !key.startsWith("sb_publishable_")) {
    throw new Error("Use a URL HTTPS e a chave pública publishable do Supabase.")
  }
  // Nunca colocar service_role ou secret keys no frontend: o APK também é público.
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "agrosense.auth" },
  })
  return client
}

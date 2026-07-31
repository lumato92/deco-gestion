// src/lib/supabase/admin.ts
//
// Cliente Supabase con service-role key. Bypassa RLS.
//
// ⚠️ SOLO código server (route handlers, server actions, server components).
// El import de 'server-only' hace fallar el build si alguien lo trae a un
// componente cliente — la key nunca puede terminar en el bundle del browser.
//
// Por qué existe: los webhooks (ML, MP) no tienen cookies de sesión. Usar el
// cliente de `server.ts` (anon key + cookies) los deja escribiendo como
// anónimos, dependiendo de RLS y fallando en silencio.

import 'server-only'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

let cliente: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  if (cliente) return cliente

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Fallar fuerte y temprano: un webhook que escribe sin permisos es peor
  // que uno que no arranca.
  if (!url) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceRoleKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')

  cliente = createSupabaseClient(url, serviceRoleKey, {
    auth: {
      // No hay usuario ni browser: nada que persistir ni refrescar.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return cliente
}

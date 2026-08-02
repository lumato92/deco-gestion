// src/app/api/ml/estado/route.ts
//
// Estado del módulo de Mercado Libre para la pantalla de integración (T7).
//
// La tabla ml_credenciales tiene RLS que la oculta al browser (para que los
// tokens no se filtren), así que la UI no puede leerla directo. Este endpoint
// la lee con el cliente admin y devuelve SOLO metadatos: cuenta, estado y
// vencimiento. Nunca el access_token ni el refresh_token.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = createAdminClient()

  const { data: cred } = await supabase
    .from('ml_credenciales')
    .select('seller_id, nickname, estado, expires_at, ultimo_error, updated_at')
    .limit(1)
    .maybeSingle()

  // Ventas de ML que no matchearon un producto interno.
  const { count: sinConciliar } = await supabase
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('canal_venta', 'mercadolibre')
    .eq('conciliado', false)

  // Últimas importaciones, para dar una idea de actividad reciente.
  const { data: importaciones } = await supabase
    .from('ml_importaciones')
    .select('ml_order_id, resultado, detalle, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  const { count: errores } = await supabase
    .from('ml_importaciones')
    .select('id', { count: 'exact', head: true })
    .eq('resultado', 'error')

  return NextResponse.json({
    conectado: Boolean(cred),
    sync_habilitado: process.env.ML_SYNC_ENABLED === 'true',
    cuenta: cred
      ? {
          seller_id: cred.seller_id,
          nickname: cred.nickname,
          estado: cred.estado, // 'activo' | 'degradado'
          expires_at: cred.expires_at,
          ultimo_error: cred.ultimo_error,
          actualizado: cred.updated_at,
        }
      : null,
    sin_conciliar: sinConciliar ?? 0,
    errores: errores ?? 0,
    importaciones: importaciones ?? [],
  })
}

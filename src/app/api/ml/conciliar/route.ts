// src/app/api/ml/conciliar/route.ts
//
// Descuenta el stock de ventas de ML que entraron sin producto asociado, una
// vez que su publicación ya está vinculada.
//
// Mismo contrato que /api/ml/backfill: por defecto SIMULA. Hay que pedir
// dry_run: false para escribir. Las líneas a aplicar se recalculan acá en el
// servidor, no se toman del browser: lo que se descuenta es lo que la base
// dice que está pendiente en este momento.
//
// Requiere login: no está en las rutas públicas del middleware.

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { leerCredencial } from '@/lib/ml/credenciales'
import { aplicar, buscarPendientes, simular } from '@/lib/ml/conciliar'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  let cuerpo: { dry_run?: boolean; ml_item_id?: string }
  try {
    cuerpo = await req.json()
  } catch {
    cuerpo = {}
  }

  const simulacion = cuerpo.dry_run !== false
  const supabase = createAdminClient()

  try {
    // El seller solo hace falta para releer órdenes viejas sin ml_item_id.
    const sellerId = await leerCredencial(supabase).then(c => c.seller_id).catch(() => undefined)

    const pendientes = await buscarPendientes(supabase, { mlItemId: cuerpo.ml_item_id, sellerId })
    const sim = simular(pendientes)

    if (simulacion) {
      return NextResponse.json({ ok: true, simulacion: true, ...sim })
    }

    const resultado = await aplicar(supabase, sim.conciliables)
    console.log('[ml][conciliar] aplicado', resultado)

    return NextResponse.json({ ok: true, simulacion: false, resultado, productos: sim.productos })
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)
    console.error('[ml][conciliar] error', mensaje)
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 })
  }
}

// src/app/api/ml/webhook/route.ts
//
// T4 — Recibe las notificaciones `orders_v2` de Mercado Libre.
//
// Seguridad: este endpoint es público, así que NO se confía en el body.
// El body solo aporta un id; la orden se relee desde la API de ML con nuestro
// token y esa respuesta es la única verdad. Una notificación inventada muere
// en el 404 del GET.
//
// Contrato de respuesta: ML espera un 200 y reintenta cada 15 minutos si no lo
// recibe (timeout de 22s, holgado para el trabajo que hacemos acá). Devolvemos
// 200 en casi todos los casos, incluso al ignorar: un 500 solo consigue que ML
// reintente algo que ya sabemos que no va a funcionar. Reservamos el 500 para
// fallas transitorias, donde el reintento sí sirve.

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchOrden, idDesdeResource } from '@/lib/ml/client'
import { importarOrden, registrarImportacion } from '@/lib/ml/importar-orden'
import { enviarAlerta } from '@/lib/ml/alertas'
import {
  MLNetworkError,
  MLRateLimitError,
  MLRefreshError,
  MLSinCredencialesError,
} from '@/lib/ml/errores'
import type { NotificacionML } from '@/lib/ml/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (process.env.ML_SYNC_ENABLED !== 'true') {
    return NextResponse.json({ ok: true, motivo: 'sync_deshabilitado' })
  }

  let notificacion: Partial<NotificacionML>
  try {
    notificacion = await req.json()
  } catch {
    return NextResponse.json({ ok: true, motivo: 'body_ilegible' })
  }

  const ordenId = idDesdeResource(notificacion.resource)

  // Notificación de otro tópico o sin resource usable: no es un error nuestro.
  if (!ordenId || !notificacion.topic?.startsWith('orders')) {
    console.log('[ml][webhook] notificación ignorada', {
      topic: notificacion.topic,
      resource: notificacion.resource,
    })
    return NextResponse.json({ ok: true, motivo: 'sin_orden' })
  }

  const supabase = createAdminClient()
  const sellerId = notificacion.user_id ? String(notificacion.user_id) : undefined

  console.log('[ml][webhook] recibida', {
    ml_order_id: ordenId,
    topic: notificacion.topic,
    intento: notificacion.attempts,
  })

  try {
    // Revalidación: la verdad la dice ML, no el body.
    const orden = await fetchOrden(supabase, ordenId, sellerId)

    if (!orden) {
      await registrarImportacion(supabase, {
        mlOrderId: ordenId,
        resultado: 'ignorada',
        detalle: 'ML devolvió 404: la orden no existe (notificación no verificable).',
      })
      return NextResponse.json({ ok: true, motivo: 'orden_inexistente' })
    }

    const resultado = await importarOrden(supabase, orden, { sellerId })

    await registrarImportacion(supabase, {
      mlOrderId: ordenId,
      resultado: resultado.resultado,
      pedidoId: resultado.pedidoId,
      detalle: resultado.detalle,
      payload: orden,
    })

    console.log('[ml][webhook] procesada', {
      ml_order_id: ordenId,
      resultado: resultado.resultado,
      pedido_id: resultado.pedidoId,
    })

    return NextResponse.json({ ok: true, ...resultado })
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)

    await registrarImportacion(supabase, {
      mlOrderId: ordenId,
      resultado: 'error',
      detalle: mensaje,
    })

    // Transitorios: pedimos el reintento de ML devolviendo 500.
    if (e instanceof MLNetworkError || e instanceof MLRateLimitError) {
      console.error('[ml][webhook] falla transitoria, ML va a reintentar', mensaje)
      return NextResponse.json({ ok: false, error: mensaje }, { status: 500 })
    }

    // Token muerto o cuenta sin conectar: reintentar no arregla nada, hace
    // falta que una persona reconecte. La alerta ya la emite credenciales.ts
    // al degradar; acá solo cortamos el ciclo de reintentos.
    if (e instanceof MLRefreshError || e instanceof MLSinCredencialesError) {
      console.error('[ml][webhook] problema de credenciales', mensaje)
      return NextResponse.json({ ok: false, error: mensaje })
    }

    await enviarAlerta({
      nivel: 'critico',
      titulo: 'Error procesando una venta de ML',
      detalle: `La orden ${ordenId} no se pudo procesar: ${mensaje}`,
      contexto: { ml_order_id: ordenId },
    })

    console.error('[ml][webhook] error', mensaje)
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 })
  }
}

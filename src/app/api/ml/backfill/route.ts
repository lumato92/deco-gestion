// src/app/api/ml/backfill/route.ts
//
// Importación manual de órdenes ya cerradas en Mercado Libre.
//
// El webhook solo trae ventas NUEVAS: una orden que se cerró la semana pasada
// no genera notificación nunca más. Esto es lo que permite cargar el historial
// (y también rescatar una notificación que se haya perdido).
//
// Requiere login: no está en las rutas públicas del middleware.
//
// Es seguro correrlo de nuevo: la idempotencia por ml_order_id hace que las
// órdenes ya importadas se salteen en vez de duplicarse.

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarOrdenes, fetchOrden } from '@/lib/ml/client'
import {
  importarOrden,
  previsualizarOrden,
  registrarImportacion,
  type Previsualizacion,
} from '@/lib/ml/importar-orden'
import { leerCredencial } from '@/lib/ml/credenciales'
import type { ResultadoImportacion } from '@/lib/ml/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Importar un mes de ventas lleva su tiempo: pedimos margen. */
export const maxDuration = 300

/** Tope duro para que una fecha mal puesta no dispare cientos de requests. */
const MAX_ORDENES = 300
const PAGINA = 50
/** Respiro entre órdenes para no chocar contra el rate limit de ML. */
const PAUSA_MS = 150

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms))

interface Cuerpo {
  desde?: string
  hasta?: string
  /** Por defecto NO escribe: hay que pedirlo explícitamente. */
  dry_run?: boolean
  max?: number
}

export async function POST(req: NextRequest) {
  let cuerpo: Cuerpo
  try {
    cuerpo = await req.json()
  } catch {
    cuerpo = {}
  }

  const { desde, hasta } = cuerpo
  if (!desde || !/^\d{4}-\d{2}-\d{2}/.test(desde)) {
    return NextResponse.json(
      { error: 'Falta "desde" con formato YYYY-MM-DD' },
      { status: 400 }
    )
  }

  // Default seguro: si no pedís explícitamente escribir, solo se simula.
  const simulacion = cuerpo.dry_run !== false
  const tope = Math.min(cuerpo.max ?? MAX_ORDENES, MAX_ORDENES)

  const supabase = createAdminClient()

  try {
    const credencial = await leerCredencial(supabase)
    const sellerId = credencial.seller_id

    // ── 1. Juntar los ids del rango ──────────────────────────
    const ids: string[] = []
    let offset = 0
    let total = 0

    while (ids.length < tope) {
      const pagina = await buscarOrdenes(supabase, {
        sellerId,
        desde,
        hasta,
        offset,
        limit: PAGINA,
      })

      total = pagina.total
      if (pagina.ids.length === 0) break

      ids.push(...pagina.ids)
      offset += PAGINA
      if (offset >= total) break
    }

    const aProcesar = ids.slice(0, tope)

    console.log('[ml][backfill] órdenes encontradas', {
      desde,
      hasta,
      total,
      a_procesar: aProcesar.length,
      simulacion,
    })

    // ── 2. Procesar una por una ──────────────────────────────
    const resumen: Record<ResultadoImportacion | 'no_encontrada', number> = {
      importada: 0,
      duplicada: 0,
      sin_conciliar: 0,
      ignorada: 0,
      error: 0,
      no_encontrada: 0,
    }
    const detalle: (Previsualizacion | { mlOrderId: string; resultado: string; pedidoId: number | null; detalle: string })[] = []

    // Solo en simulación: cuánto de lo facturado se lleva ML y cuánto queda.
    const totales = { facturado: 0, comision: 0, envio: 0, impuestos: 0, neto: 0 }

    for (const id of aProcesar) {
      await dormir(PAUSA_MS)

      // Se relee cada orden con el mismo fetchOrden() del webhook, para que
      // backfill e importación automática no puedan divergir.
      const orden = await fetchOrden(supabase, id, sellerId)
      if (!orden) {
        resumen.no_encontrada++
        continue
      }

      if (simulacion) {
        const previa = await previsualizarOrden(supabase, orden, { sellerId })
        detalle.push(previa)
        if (!previa.yaImportada && previa.importable) {
          totales.facturado += previa.total
          totales.comision += previa.comision
          totales.envio += previa.envio
          totales.impuestos += previa.impuestos
          totales.neto += previa.neto
        }
        if (previa.yaImportada) resumen.duplicada++
        else if (!previa.importable) resumen.ignorada++
        else if (previa.sinMatch.length > 0) resumen.sin_conciliar++
        else resumen.importada++
        continue
      }

      const r = await importarOrden(supabase, orden, { sellerId })
      await registrarImportacion(supabase, {
        mlOrderId: id,
        resultado: r.resultado,
        pedidoId: r.pedidoId,
        detalle: `[backfill] ${r.detalle}`,
        payload: orden,
      })

      resumen[r.resultado]++
      detalle.push({
        mlOrderId: id,
        resultado: r.resultado,
        pedidoId: r.pedidoId,
        detalle: r.detalle,
      })
    }

    console.log('[ml][backfill] terminado', { simulacion, resumen })

    return NextResponse.json({
      ok: true,
      simulacion,
      mensaje: simulacion
        ? 'Simulación: no se escribió nada. Repetí con "dry_run": false para importar de verdad.'
        : 'Importación ejecutada.',
      rango: { desde, hasta: hasta ?? 'hoy' },
      total_en_ml: total,
      procesadas: aProcesar.length,
      resumen,
      ...(simulacion ? { totales } : {}),
      detalle,
    })
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)
    console.error('[ml][backfill] error', mensaje)
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 })
  }
}

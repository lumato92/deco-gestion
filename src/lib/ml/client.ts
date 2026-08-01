// src/lib/ml/client.ts
//
// Cliente de la API de Mercado Libre.
//
// Regla de seguridad del plan: el webhook NO confía en el body que llega.
// Cualquiera puede postear un JSON inventado a un endpoint público. La única
// fuente de verdad es lo que devuelve ML cuando le preguntamos con NUESTRO
// token: si la orden no existe, el GET da 404 y no se crea nada.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CostosEnvioML, OrdenML } from './types'
import {
  MLAuthError,
  MLError,
  MLNetworkError,
  MLParseError,
  MLRateLimitError,
} from './errores'
import { leerCredencial, obtenerAccessToken, refrescarToken } from './credenciales'

const API = 'https://api.mercadolibre.com'
const TIMEOUT_MS = 10_000

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms))

interface RespuestaCruda {
  status: number
  cuerpo: string
}

async function pedir(path: string, accessToken: string): Promise<RespuestaCruda> {
  try {
    const respuesta = await fetch(`${API}${path}`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return { status: respuesta.status, cuerpo: await respuesta.text() }
  } catch (e) {
    throw new MLNetworkError(
      `Falla de red hablando con ML (${path}): ${e instanceof Error ? e.message : e}`,
      { path }
    )
  }
}

/**
 * GET autenticado con los rescates del Error & Rescue Map:
 *   401 → refresca el token y reintenta una vez
 *   429 → espera y reintenta
 *   404 → null (la orden no existe: notificación falsa o borrada)
 */
export async function getML<T>(
  supabase: SupabaseClient,
  path: string,
  sellerId?: string
): Promise<T | null> {
  let accessToken = await obtenerAccessToken(supabase, sellerId)
  let respuesta = await pedir(path, accessToken)

  // 401: el token murió antes de tiempo (revocado, o cambio de permisos).
  if (respuesta.status === 401) {
    const credencial = await leerCredencial(supabase, sellerId)
    accessToken = await refrescarToken(supabase, credencial)
    respuesta = await pedir(path, accessToken)

    if (respuesta.status === 401) {
      throw new MLAuthError('ML sigue devolviendo 401 después de refrescar el token', { path })
    }
  }

  // 429: rate limit. Un solo reintento con espera; a nuestro volumen no
  // deberíamos verlo nunca, pero si aparece no queremos perder la venta.
  if (respuesta.status === 429) {
    const esperaMs = 2000
    await dormir(esperaMs)
    respuesta = await pedir(path, accessToken)

    if (respuesta.status === 429) {
      throw new MLRateLimitError('ML sigue rate-limiteando después de esperar', esperaMs, { path })
    }
  }

  if (respuesta.status === 404) return null

  if (respuesta.status < 200 || respuesta.status >= 300) {
    throw new MLError(`ML respondió ${respuesta.status} en ${path}: ${respuesta.cuerpo.slice(0, 300)}`)
  }

  try {
    return JSON.parse(respuesta.cuerpo) as T
  } catch {
    throw new MLParseError(`Respuesta de ML no es JSON (${path})`, {
      muestra: respuesta.cuerpo.slice(0, 200),
    })
  }
}

/** Extrae el id numérico de un resource tipo "/orders/2000012345678". */
export function idDesdeResource(resource: string | undefined | null): string | null {
  if (!resource) return null
  const match = /\/orders\/(\d+)/.exec(resource)
  return match ? match[1] : null
}

/**
 * Costo de envío que absorbe el VENDEDOR, en pesos.
 *
 * Sale de `senders` en /shipments/{id}/costs: la entrada cuyo `user_id` es el
 * del vendedor. El `cost` ya viene neto de los descuentos que pone ML.
 *
 * Devuelve 0 si el envío no le cuesta nada al vendedor (lo pagó el comprador o
 * lo bonificó ML), que es el caso más común.
 */
export async function costoEnvioVendedor(
  supabase: SupabaseClient,
  shipmentId: number | string,
  sellerId?: string
): Promise<number> {
  const costos = await getML<CostosEnvioML>(
    supabase,
    `/shipments/${shipmentId}/costs`,
    sellerId
  )

  if (!costos?.senders?.length) return 0

  // Normalmente hay un solo sender (el vendedor). Si viene el sellerId lo
  // usamos para no confundirnos; si no, sumamos todos.
  const propios = sellerId
    ? costos.senders.filter(s => String(s.user_id) === String(sellerId))
    : costos.senders

  return (propios.length ? propios : costos.senders)
    .reduce((total, s) => total + (s.cost ?? 0), 0)
}

export interface PaginaOrdenes {
  ids: string[]
  total: number
}

/**
 * Busca órdenes del vendedor en un rango de fechas.
 *
 * Devuelve solo los ids: el backfill después trae cada orden con fetchOrden(),
 * el mismo camino que usa el webhook. Cuesta una request extra por orden pero
 * garantiza que backfill e importación automática vean exactamente los mismos
 * datos, en vez de tener dos formas distintas de leer una orden.
 *
 * ML pide las fechas en ISO con precisión de hora (descarta minutos y abajo).
 */
export async function buscarOrdenes(
  supabase: SupabaseClient,
  opciones: {
    sellerId: string
    desde: string
    hasta?: string
    offset?: number
    limit?: number
  }
): Promise<PaginaOrdenes> {
  const params = new URLSearchParams({
    seller: opciones.sellerId,
    'order.status': 'paid',
    sort: 'date_asc',
    offset: String(opciones.offset ?? 0),
    limit: String(opciones.limit ?? 50),
  })
  params.set('order.date_created.from', aFechaML(opciones.desde))
  if (opciones.hasta) params.set('order.date_created.to', aFechaML(opciones.hasta))

  const respuesta = await getML<{
    results?: { id: number }[]
    paging?: { total?: number }
  }>(supabase, `/orders/search?${params.toString()}`, opciones.sellerId)

  if (!respuesta) return { ids: [], total: 0 }

  return {
    ids: (respuesta.results ?? []).map(o => String(o.id)),
    total: respuesta.paging?.total ?? 0,
  }
}

/** '2026-07-01' → '2026-07-01T00:00:00.000-00:00' (formato que espera ML). */
export function aFechaML(fecha: string): string {
  if (fecha.includes('T')) return fecha
  return `${fecha}T00:00:00.000-00:00`
}

/** Trae la orden real desde ML. null = no existe (notificación no confiable). */
export async function fetchOrden(
  supabase: SupabaseClient,
  ordenId: string,
  sellerId?: string
): Promise<OrdenML | null> {
  const orden = await getML<OrdenML>(supabase, `/orders/${ordenId}`, sellerId)
  if (!orden) return null

  if (typeof orden.id !== 'number' || !Array.isArray(orden.order_items)) {
    throw new MLParseError('La orden de ML no tiene la forma esperada', { ordenId })
  }

  return orden
}

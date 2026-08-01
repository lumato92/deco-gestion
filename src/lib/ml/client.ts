// src/lib/ml/client.ts
//
// Cliente de la API de Mercado Libre.
//
// Regla de seguridad del plan: el webhook NO confía en el body que llega.
// Cualquiera puede postear un JSON inventado a un endpoint público. La única
// fuente de verdad es lo que devuelve ML cuando le preguntamos con NUESTRO
// token: si la orden no existe, el GET da 404 y no se crea nada.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrdenML } from './types'
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

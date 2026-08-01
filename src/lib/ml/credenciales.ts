// src/lib/ml/credenciales.ts
//
// T3 + T8 — Ciclo de vida del token de Mercado Libre.
//
//   [SIN_TOKEN] --callback OAuth--> [ACTIVO] --refresh ok--> [ACTIVO]
//                                      |                        |
//                                 refresh falla           expira (~6h)
//                                      v                        |
//                                 [DEGRADADO] <-----------------+
//                                      | (alerta: reconectar a mano)
//                                      v
//                                   [ACTIVO]

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CredencialML, TokenML } from './types'
import {
  MLNetworkError,
  MLParseError,
  MLRefreshError,
  MLSinCredencialesError,
} from './errores'
import { enviarAlerta } from './alertas'

const URL_TOKEN = 'https://api.mercadolibre.com/oauth/token'

/** Margen para no usar un token que vence mientras estamos hablando con ML. */
const MARGEN_VENCIMIENTO_MS = 60_000

/** Espera de un perdedor del claim antes de releer el token del ganador. */
const ESPERA_REINTENTO_MS = 400
const REINTENTOS_LECTURA = 4

function clientId() {
  const v = process.env.ML_CLIENT_ID
  if (!v) throw new MLRefreshError('Falta ML_CLIENT_ID')
  return v
}

function clientSecret() {
  const v = process.env.ML_CLIENT_SECRET
  if (!v) throw new MLRefreshError('Falta ML_CLIENT_SECRET')
  return v
}

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * POST /oauth/token. Sirve tanto para canjear el `code` del callback como para
 * refrescar. ML espera form-urlencoded, no JSON.
 */
export async function pedirToken(
  params: Record<string, string>
): Promise<TokenML> {
  let respuesta: Response
  try {
    respuesta = await fetch(URL_TOKEN, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (e) {
    throw new MLNetworkError(
      `No se pudo contactar el endpoint de token de ML: ${e instanceof Error ? e.message : e}`
    )
  }

  const crudo = await respuesta.text()

  if (!respuesta.ok) {
    // El cuerpo del error de ML dice el motivo real (invalid_grant, etc.).
    throw new MLRefreshError(`ML rechazó el token (${respuesta.status}): ${crudo.slice(0, 300)}`, {
      status: respuesta.status,
    })
  }

  let token: TokenML
  try {
    token = JSON.parse(crudo) as TokenML
  } catch {
    throw new MLParseError(`Respuesta de token no es JSON: ${crudo.slice(0, 200)}`)
  }

  if (!token.access_token || !token.refresh_token) {
    throw new MLParseError('La respuesta de token vino sin access_token o refresh_token')
  }

  return token
}

/** Convierte expires_in (segundos) en el timestamp absoluto que guardamos. */
export function calcularExpiracion(expiresIn: number, desde = Date.now()): string {
  return new Date(desde + expiresIn * 1000).toISOString()
}

/** Guarda (o pisa) las credenciales de un vendedor y lo deja en estado activo. */
export async function guardarCredencial(
  supabase: SupabaseClient,
  token: TokenML,
  nickname?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('ml_credenciales')
    .upsert(
      {
        seller_id: String(token.user_id),
        ...(nickname !== undefined ? { nickname } : {}),
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: calcularExpiracion(token.expires_in),
        estado: 'activo',
        ultimo_error: null,
        refresh_lock_hasta: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'seller_id' }
    )

  if (error) throw new MLRefreshError(`No se pudo guardar la credencial: ${error.message}`)
}

export async function leerCredencial(
  supabase: SupabaseClient,
  sellerId?: string
): Promise<CredencialML> {
  let query = supabase
    .from('ml_credenciales')
    .select('id, seller_id, nickname, access_token, refresh_token, expires_at, estado, ultimo_error')

  // Sin seller_id explícito tomamos la única cuenta conectada (baseline
  // mono-cuenta; el día que haya varias, el webhook pasa el user_id).
  query = sellerId ? query.eq('seller_id', sellerId) : query.limit(1)

  const { data, error } = await query.maybeSingle()

  if (error) throw new MLSinCredencialesError(`Error leyendo credenciales: ${error.message}`)
  if (!data) throw new MLSinCredencialesError('No hay ninguna cuenta de Mercado Libre conectada')

  return data as CredencialML
}

async function marcarDegradada(
  supabase: SupabaseClient,
  sellerId: string,
  motivo: string
): Promise<void> {
  await supabase
    .from('ml_credenciales')
    .update({ estado: 'degradado', ultimo_error: motivo, refresh_lock_hasta: null, updated_at: new Date().toISOString() })
    .eq('seller_id', sellerId)

  await enviarAlerta({
    nivel: 'critico',
    titulo: 'Mercado Libre desconectado',
    detalle:
      'Falló la renovación del token y no entran más ventas de ML hasta reconectar la cuenta a mano desde la app.',
    contexto: { seller_id: sellerId, motivo },
  })
}

function estaVigente(credencial: CredencialML): boolean {
  return new Date(credencial.expires_at).getTime() - MARGEN_VENCIMIENTO_MS > Date.now()
}

/**
 * Devuelve un access_token utilizable, refrescando si hace falta.
 *
 * El refresh está serializado (T8): solo el que gana el claim en Postgres
 * habla con ML. Los demás esperan y releen el token que dejó el ganador, en
 * vez de quemar el refresh_token de un solo uso.
 */
export async function obtenerAccessToken(
  supabase: SupabaseClient,
  sellerId?: string
): Promise<string> {
  const credencial = await leerCredencial(supabase, sellerId)

  if (credencial.estado === 'degradado') {
    throw new MLRefreshError(
      'La cuenta de Mercado Libre está degradada: hay que reconectarla a mano.',
      { seller_id: credencial.seller_id }
    )
  }

  if (estaVigente(credencial)) return credencial.access_token

  return refrescarToken(supabase, credencial)
}

/** Fuerza el refresh de una credencial concreta, respetando el claim. */
export async function refrescarToken(
  supabase: SupabaseClient,
  credencial: CredencialML
): Promise<string> {
  const sellerId = credencial.seller_id

  const { data: gano, error: errClaim } = await supabase
    .rpc('ml_reclamar_refresh', { p_seller_id: sellerId, p_segundos: 30 })

  if (errClaim) {
    throw new MLRefreshError(`No se pudo reclamar el refresh: ${errClaim.message}`, {
      seller_id: sellerId,
    })
  }

  // Perdimos el claim: otro handler está refrescando. Esperamos su resultado.
  if (!gano) {
    for (let intento = 0; intento < REINTENTOS_LECTURA; intento++) {
      await dormir(ESPERA_REINTENTO_MS)
      const fresca = await leerCredencial(supabase, sellerId)
      if (fresca.estado === 'degradado') {
        throw new MLRefreshError('El refresh concurrente falló y la cuenta quedó degradada', {
          seller_id: sellerId,
        })
      }
      if (estaVigente(fresca)) return fresca.access_token
    }
    throw new MLRefreshError('Timeout esperando el refresh de otro proceso', {
      seller_id: sellerId,
    })
  }

  // Ganamos: somos los únicos autorizados a usar el refresh_token.
  try {
    const token = await pedirToken({
      grant_type: 'refresh_token',
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: credencial.refresh_token,
    })

    await guardarCredencial(supabase, token, credencial.nickname)
    return token.access_token
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e)

    // Un problema de red es transitorio: liberamos el lock y que el próximo
    // intento lo vuelva a probar. Degradar la cuenta por un timeout sería
    // pedirle a Lucas que reconecte por nada.
    if (e instanceof MLNetworkError) {
      await supabase.rpc('ml_liberar_refresh', { p_seller_id: sellerId })
      throw e
    }

    // Cualquier otra cosa (invalid_grant, token revocado) sí es terminal.
    await marcarDegradada(supabase, sellerId, motivo)
    throw new MLRefreshError(motivo, { seller_id: sellerId })
  }
}

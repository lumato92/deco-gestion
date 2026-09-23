// src/lib/ml/publicaciones.ts
//
// Publicaciones activas de la cuenta de ML, para poder vincularlas con
// productos internos (tabla ml_publicaciones).
//
// La sincronización es solo ML → sistema: acá se lee, nunca se escribe en ML.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getML } from './client'
import type { BusquedaItemsML, MultigetItemML, PublicacionML } from './types'

const PAGINA = 50
/** ML acepta hasta 20 ids por multiget. */
const LOTE_MULTIGET = 20
/** Tope para que una cuenta enorme no dispare cientos de requests. */
const MAX_PUBLICACIONES = 500

const ATRIBUTOS = 'id,title,price,available_quantity,status,thumbnail,permalink'

/** Ids de las publicaciones activas del vendedor, paginando la búsqueda. */
export async function idsPublicacionesActivas(
  supabase: SupabaseClient,
  sellerId: string
): Promise<string[]> {
  const ids: string[] = []
  let offset = 0

  while (ids.length < MAX_PUBLICACIONES) {
    const params = new URLSearchParams({
      status: 'active',
      offset: String(offset),
      limit: String(PAGINA),
    })
    const pagina = await getML<BusquedaItemsML>(
      supabase,
      `/users/${sellerId}/items/search?${params.toString()}`,
      sellerId
    )

    const resultados = pagina?.results ?? []
    if (resultados.length === 0) break

    ids.push(...resultados)
    offset += PAGINA
    if (offset >= (pagina?.paging?.total ?? 0)) break
  }

  return ids.slice(0, MAX_PUBLICACIONES)
}

/**
 * Detalle de un conjunto de publicaciones por multiget.
 *
 * Una entrada con code != 200 (publicación borrada, sin permiso) se descarta
 * en vez de tirar: que falte una no puede dejar sin pantalla al resto.
 */
export async function detallePublicaciones(
  supabase: SupabaseClient,
  ids: string[],
  sellerId?: string
): Promise<PublicacionML[]> {
  const publicaciones: PublicacionML[] = []

  for (let i = 0; i < ids.length; i += LOTE_MULTIGET) {
    const lote = ids.slice(i, i + LOTE_MULTIGET)
    const respuesta = await getML<MultigetItemML[]>(
      supabase,
      `/items?ids=${lote.join(',')}&attributes=${ATRIBUTOS}`,
      sellerId
    )

    for (const entrada of respuesta ?? []) {
      if (entrada.code === 200 && entrada.body) publicaciones.push(entrada.body)
    }
  }

  return publicaciones
}

export async function listarPublicacionesActivas(
  supabase: SupabaseClient,
  sellerId: string
): Promise<PublicacionML[]> {
  const ids = await idsPublicacionesActivas(supabase, sellerId)
  return detallePublicaciones(supabase, ids, sellerId)
}

// src/test/fake-supabase.ts
//
// Doble de prueba del cliente de Supabase: registra lo que se le pidió escribir
// y devuelve las respuestas que le configures. Sin red, sin base de datos.
//
// Cubre solo la superficie que usa el código bajo test:
//   from(tabla).insert(payload)                        → await { error }
//   from(tabla).insert(payload).select(cols).single()  → { data, error }
//   from(tabla).update(payload).eq(col, val)           → await { error }
//   rpc(nombre, args)                                  → { data, error }

import type { SupabaseClient } from '@supabase/supabase-js'

export interface InsertRegistrado {
  tabla: string
  payload: unknown
}

export interface UpdateRegistrado {
  tabla: string
  payload: unknown
  columna: string
  valor: unknown
}

export interface RpcRegistrado {
  nombre: string
  args: unknown
}

export interface RegistroSupabase {
  inserts: InsertRegistrado[]
  updates: UpdateRegistrado[]
  rpcs: RpcRegistrado[]
}

interface Respuesta {
  data?: unknown
  error?: { message: string } | null
}

export interface ConfigFake {
  /** id que devuelve el insert en `pedidos`. */
  pedidoId?: number
  /** Error por tabla en insert. Clave = nombre de la tabla. */
  erroresInsert?: Record<string, string>
  /** Error por tabla en update. Clave = nombre de la tabla. */
  erroresUpdate?: Record<string, string>
  /** Respuesta del rpc. Default: stock descontado ok. */
  rpc?: Respuesta
}

export function crearFakeSupabase(config: ConfigFake = {}) {
  const registro: RegistroSupabase = { inserts: [], updates: [], rpcs: [] }
  const pedidoId = config.pedidoId ?? 101

  const cliente = {
    from(tabla: string) {
      return {
        insert(payload: unknown) {
          registro.inserts.push({ tabla, payload })

          const mensaje = config.erroresInsert?.[tabla]
          const error = mensaje ? { message: mensaje } : null
          const conFila = { data: error ? null : { id: pedidoId }, error }
          const sinFila = { data: null, error }

          return {
            // await insert(...)  → no pide fila de vuelta
            then: (
              ok?: ((valor: typeof sinFila) => unknown) | null,
              ko?: ((motivo: unknown) => unknown) | null
            ) => Promise.resolve(sinFila).then(ok, ko),
            // insert(...).select('id').single()  → sí la pide
            select: () => ({ single: async () => conFila }),
          }
        },

        update(payload: unknown) {
          return {
            eq: async (columna: string, valor: unknown) => {
              registro.updates.push({ tabla, payload, columna, valor })
              const mensaje = config.erroresUpdate?.[tabla]
              return { data: null, error: mensaje ? { message: mensaje } : null }
            },
          }
        },
      }
    },

    async rpc(nombre: string, args: unknown) {
      registro.rpcs.push({ nombre, args })
      return config.rpc ?? { data: { ok: true }, error: null }
    },
  }

  return { supabase: cliente as unknown as SupabaseClient, registro }
}

/**
 * Devuelve el payload del primer insert sobre una tabla.
 * El tipo se pide en la llamada: `insertDe(reg, 'pedidos')` para una fila,
 * `insertDe<unknown[]>(reg, 'items_pedido')` para un lote.
 */
export function insertDe<T = Record<string, unknown>>(
  registro: RegistroSupabase,
  tabla: string
): T {
  return registro.inserts.find(i => i.tabla === tabla)?.payload as T
}

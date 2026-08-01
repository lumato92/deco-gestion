// Tests de la previsualización del backfill.
//
// Importa que sea de SOLO LECTURA: es lo que hace seguro apuntarla a un mes
// entero de ventas reales antes de escribir nada.

import { describe, it, expect, vi } from 'vitest'
import { previsualizarOrden } from './importar-orden'
import type { OrdenML } from './types'

vi.mock('./alertas', () => ({ enviarAlerta: vi.fn(async () => {}) }))

function orden(cambios: Partial<OrdenML> = {}): OrdenML {
  return {
    id: 2000099,
    status: 'paid',
    date_created: '2026-07-10T10:00:00.000Z',
    date_closed: '2026-07-10T11:00:00.000Z',
    total_amount: 45000,
    order_items: [
      { item: { id: 'MLA555', title: 'Repisa flotante' }, quantity: 1, unit_price: 45000, sale_fee: 5850 },
    ],
    ...cambios,
  }
}

function fake(opciones: { existente?: number; productos?: { ml_item_id: string }[] } = {}) {
  const escrituras: string[] = []

  const supabase = {
    from(tabla: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: opciones.existente ? { id: opciones.existente } : null,
              error: null,
            }),
          }),
          in: async () => ({ data: opciones.productos ?? [], error: null }),
        }),
        insert: () => { escrituras.push(`insert:${tabla}`); return { then: (ok: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(ok) } },
        update: () => { escrituras.push(`update:${tabla}`); return { eq: async () => ({ error: null }) } },
      }
    },
    rpc: async () => { escrituras.push('rpc'); return { data: null, error: null } },
  }

  return { supabase: supabase as never, escrituras }
}

describe('previsualizarOrden', () => {
  it('no escribe absolutamente nada', async () => {
    const { supabase, escrituras } = fake({ productos: [{ ml_item_id: 'MLA555' }] })

    await previsualizarOrden(supabase, orden())

    expect(escrituras).toEqual([])
  })

  it('avisa qué se importaría bien', async () => {
    const { supabase } = fake({ productos: [{ ml_item_id: 'MLA555' }] })

    const p = await previsualizarOrden(supabase, orden())

    expect(p).toMatchObject({
      mlOrderId: '2000099',
      importable: true,
      yaImportada: false,
      sinMatch: [],
      total: 45000,
      comision: 5850,
      fecha: '2026-07-10T11:00:00.000Z',
    })
  })

  it('marca las publicaciones sin producto asociado', async () => {
    const { supabase } = fake({ productos: [] })

    const p = await previsualizarOrden(supabase, orden())

    expect(p.sinMatch).toEqual(['MLA555 (Repisa flotante)'])
  })

  it('detecta las que ya estaban importadas', async () => {
    const { supabase } = fake({ existente: 320 })

    const p = await previsualizarOrden(supabase, orden())

    expect(p).toMatchObject({ yaImportada: true, pedidoExistente: 320 })
    // Ya importada: ni se molesta en buscar el match.
    expect(p.sinMatch).toEqual([])
  })

  it('marca como no importable una orden que no está paga', async () => {
    const { supabase } = fake({ productos: [{ ml_item_id: 'MLA555' }] })

    const p = await previsualizarOrden(supabase, orden({ status: 'cancelled' }))

    expect(p.importable).toBe(false)
  })
})

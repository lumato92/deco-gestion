// Tests de la importación de órdenes de ML.
//
// Los dos que más importan:
//   · "el test de las 2am": una notificación duplicada de una orden con 3
//     items no crea pedidos duplicados ni descuenta stock dos veces.
//   · el mapeo orden → pedido, que es donde se define cuánta plata y cuánto
//     stock se mueve.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { importarOrden, calcularComision } from './importar-orden'
import type { OrdenML } from './types'

// Las alertas salen por red: las silenciamos y las inspeccionamos.
vi.mock('./alertas', () => ({
  enviarAlerta: vi.fn(async () => {}),
}))
import { enviarAlerta } from './alertas'

const alertaMock = vi.mocked(enviarAlerta)

beforeEach(() => {
  alertaMock.mockClear()
})

function orden(cambios: Partial<OrdenML> = {}): OrdenML {
  return {
    id: 2000012345678,
    status: 'paid',
    date_created: '2026-07-20T10:00:00.000Z',
    date_closed: '2026-07-20T10:05:00.000Z',
    total_amount: 60000,
    currency_id: 'ARS',
    buyer: { id: 999, nickname: 'COMPRADOR123' },
    order_items: [
      {
        item: { id: 'MLA111', title: 'Espejo redondo 60cm' },
        quantity: 2,
        unit_price: 30000,
        sale_fee: 7800,
      },
    ],
    ...cambios,
  }
}

/**
 * Fake de Supabase enfocado en la importación: maneja el lookup de
 * idempotencia, el match de productos y delega el alta al mismo camino que
 * usa la venta directa.
 */
function fakeSupabase(opciones: {
  pedidoExistente?: number | null
  productos?: { id: number; costo: number; ml_item_id: string }[]
  pedidoId?: number
  rpcStock?: { data: unknown; error: { message: string } | null }
  errorInsertPedido?: string
} = {}) {
  const inserts: { tabla: string; payload: unknown }[] = []
  const pedidoId = opciones.pedidoId ?? 501

  const cliente = {
    from(tabla: string) {
      return {
        select() {
          return {
            eq: () => ({
              maybeSingle: async () => ({
                data: opciones.pedidoExistente ? { id: opciones.pedidoExistente } : null,
                error: null,
              }),
            }),
            in: async () => ({ data: opciones.productos ?? [], error: null }),
          }
        },
        insert(payload: unknown) {
          inserts.push({ tabla, payload })
          const error =
            tabla === 'pedidos' && opciones.errorInsertPedido
              ? { message: opciones.errorInsertPedido }
              : null
          return {
            then: (ok: ((v: { data: null; error: unknown }) => unknown) | null | undefined,
                   ko: ((e: unknown) => unknown) | null | undefined) =>
              Promise.resolve({ data: null, error }).then(ok, ko),
            select: () => ({
              single: async () => ({ data: error ? null : { id: pedidoId }, error }),
            }),
          }
        },
        update() {
          return { eq: async () => ({ data: null, error: null }) }
        },
      }
    },
    async rpc() {
      return opciones.rpcStock ?? { data: { ok: true }, error: null }
    },
  }

  return { supabase: cliente as never, inserts }
}

const pedidoInsertado = (inserts: { tabla: string; payload: unknown }[]) =>
  inserts.find(i => i.tabla === 'pedidos')?.payload as Record<string, unknown>

describe('idempotencia', () => {
  it('no vuelve a importar una orden que ya existe', async () => {
    const { supabase, inserts } = fakeSupabase({ pedidoExistente: 77 })

    const r = await importarOrden(supabase, orden())

    expect(r.resultado).toBe('duplicada')
    expect(r.pedidoId).toBe(77)
    expect(inserts).toEqual([])
  })

  it('tres notificaciones de la misma orden crean un solo pedido', async () => {
    // La 1ra importa; a partir de ahí el lookup encuentra el pedido.
    let existente: number | null = null
    const inserts: unknown[] = []

    const supabase = {
      from(tabla: string) {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: existente ? { id: existente } : null, error: null }) }),
            in: async () => ({ data: [{ id: 1, costo: 12000, ml_item_id: 'MLA111' }], error: null }),
          }),
          insert: (payload: unknown) => {
            if (tabla === 'pedidos') { existente = 900; inserts.push(payload) }
            return {
              then: (ok: ((v: unknown) => unknown) | null | undefined) =>
                Promise.resolve({ data: null, error: null }).then(ok),
              select: () => ({ single: async () => ({ data: { id: 900 }, error: null }) }),
            }
          },
          update: () => ({ eq: async () => ({ data: null, error: null }) }),
        }
      },
      rpc: async () => ({ data: { ok: true }, error: null }),
    } as never

    const r1 = await importarOrden(supabase, orden())
    const r2 = await importarOrden(supabase, orden())
    const r3 = await importarOrden(supabase, orden())

    expect(r1.resultado).toBe('importada')
    expect(r2.resultado).toBe('duplicada')
    expect(r3.resultado).toBe('duplicada')
    expect(inserts).toHaveLength(1)
  })

  it('trata el choque del UNIQUE como duplicada, no como error', async () => {
    // Carrera real: dos webhooks pasan el chequeo previo a la vez y uno pierde
    // contra el índice único.
    const { supabase } = fakeSupabase({
      errorInsertPedido: 'duplicate key value violates unique constraint "pedidos_ml_order_id_key"',
    })

    const r = await importarOrden(supabase, orden())

    expect(r.resultado).toBe('duplicada')
    expect(alertaMock).not.toHaveBeenCalled()
  })
})

describe('estados de la orden', () => {
  it('ignora una orden que todavía no está paga', async () => {
    const { supabase, inserts } = fakeSupabase()

    const r = await importarOrden(supabase, orden({ status: 'payment_in_process' }))

    expect(r.resultado).toBe('ignorada')
    expect(inserts).toEqual([])
  })

  it('importa cuando está paga', async () => {
    const { supabase } = fakeSupabase({
      productos: [{ id: 1, costo: 12000, ml_item_id: 'MLA111' }],
    })

    const r = await importarOrden(supabase, orden({ status: 'paid' }))

    expect(r.resultado).toBe('importada')
  })
})

describe('mapeo orden → pedido', () => {
  it('mapea canal, fecha, total y comisión', async () => {
    const { supabase, inserts } = fakeSupabase({
      productos: [{ id: 1, costo: 12000, ml_item_id: 'MLA111' }],
    })

    await importarOrden(supabase, orden())

    expect(pedidoInsertado(inserts)).toMatchObject({
      canal_venta: 'mercadolibre',
      origen_venta: 'directa',
      estado: 'confirmado',
      cliente_id: null,
      ml_order_id: '2000012345678',
      conciliado: true,
      fecha_pedido: '2026-07-20T10:05:00.000Z', // date_closed
    })

    expect(inserts.find(i => i.tabla === 'pagos_pedido')?.payload).toMatchObject({
      monto: 60000,
      comisiones: 7800,
      metodo_pago: 'mercadopago',
    })
  })

  it('usa el costo del producto interno, no el de ML', async () => {
    const { supabase, inserts } = fakeSupabase({
      productos: [{ id: 42, costo: 12000, ml_item_id: 'MLA111' }],
    })

    await importarOrden(supabase, orden())

    expect(inserts.find(i => i.tabla === 'items_pedido')?.payload).toEqual([
      {
        pedido_id: 501,
        producto_id: 42,
        nombre_producto: 'Espejo redondo 60cm',
        cantidad: 2,
        precio_unitario: 30000,
        costo_unitario: 12000,
        requiere_fabricacion: false,
      },
    ])
  })

  it('suma el sale_fee de todos los items', () => {
    const conVariosItems = orden({
      order_items: [
        { item: { id: 'MLA1', title: 'A' }, quantity: 1, unit_price: 100, sale_fee: 13 },
        { item: { id: 'MLA2', title: 'B' }, quantity: 2, unit_price: 200, sale_fee: 26 },
      ],
    })

    expect(calcularComision(conVariosItems)).toBe(39)
  })

  it('cae a date_created si la orden no tiene date_closed', async () => {
    const { supabase, inserts } = fakeSupabase({
      productos: [{ id: 1, costo: 1, ml_item_id: 'MLA111' }],
    })

    await importarOrden(supabase, orden({ date_closed: null }))

    expect(pedidoInsertado(inserts).fecha_pedido).toBe('2026-07-20T10:00:00.000Z')
  })
})

describe('conciliación', () => {
  it('marca sin conciliar y alerta cuando la publicación no matchea', async () => {
    const { supabase, inserts } = fakeSupabase({ productos: [] })

    const r = await importarOrden(supabase, orden())

    expect(r.resultado).toBe('sin_conciliar')
    expect(pedidoInsertado(inserts)).toMatchObject({ conciliado: false })

    // El item entra igual, con producto_id null: la venta ocurrió, pero no
    // podemos descontar stock de un producto que no sabemos cuál es.
    const items = inserts.find(i => i.tabla === 'items_pedido')?.payload as Record<string, unknown>[]
    expect(items[0].producto_id).toBeNull()

    expect(alertaMock).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: 'Venta de ML sin conciliar' })
    )
  })

  it('concilia parcialmente si solo uno de dos items matchea', async () => {
    const { supabase, inserts } = fakeSupabase({
      productos: [{ id: 5, costo: 100, ml_item_id: 'MLA1' }],
    })

    const r = await importarOrden(supabase, orden({
      order_items: [
        { item: { id: 'MLA1', title: 'Conocido' }, quantity: 1, unit_price: 100, sale_fee: 10 },
        { item: { id: 'MLA2', title: 'Desconocido' }, quantity: 1, unit_price: 200, sale_fee: 20 },
      ],
    }))

    expect(r.resultado).toBe('sin_conciliar')
    const items = inserts.find(i => i.tabla === 'items_pedido')?.payload as Record<string, unknown>[]
    expect(items[0].producto_id).toBe(5)
    expect(items[1].producto_id).toBeNull()
  })
})

describe('fallas', () => {
  it('conserva el pedido y alerta si no alcanza el stock', async () => {
    const { supabase } = fakeSupabase({
      productos: [{ id: 1, costo: 100, ml_item_id: 'MLA111' }],
      rpcStock: { data: { ok: false, errores: [{ producto_id: 1 }] }, error: null },
    })

    const r = await importarOrden(supabase, orden())

    expect(r.resultado).toBe('importada')
    expect(r.pedidoId).toBe(501)
    expect(alertaMock).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: 'Venta de ML sin stock suficiente' })
    )
  })

  it('alerta fuerte si el alta falla por un motivo desconocido', async () => {
    const { supabase } = fakeSupabase({ errorInsertPedido: 'connection reset' })

    const r = await importarOrden(supabase, orden())

    expect(r.resultado).toBe('error')
    expect(alertaMock).toHaveBeenCalledWith(
      expect.objectContaining({ nivel: 'critico' })
    )
  })

  it('no importa una orden sin items', async () => {
    const { supabase, inserts } = fakeSupabase()

    const r = await importarOrden(supabase, orden({ order_items: [] }))

    expect(r.resultado).toBe('error')
    expect(inserts).toEqual([])
    expect(alertaMock).toHaveBeenCalled()
  })
})

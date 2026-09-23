import { describe, it, expect, vi, beforeEach } from 'vitest'
import { simular, aplicar, type LineaPendiente } from './conciliar'

vi.mock('./client', () => ({ fetchOrden: vi.fn() }))
vi.mock('./alertas', () => ({ enviarAlerta: vi.fn(async () => {}) }))
import { enviarAlerta } from './alertas'
const alertaMock = vi.mocked(enviarAlerta)

beforeEach(() => alertaMock.mockClear())

const lampara = { id: 7, nombre: 'Lámpara Hongo', stock: 3, es_kit: false }

function linea(cambios: Partial<LineaPendiente> = {}): LineaPendiente {
  return {
    itemId: 1,
    pedidoId: 100,
    mlOrderId: '2000001',
    fecha: '2026-08-01T10:00:00Z',
    mlItemId: 'MLA111',
    titulo: 'Lampara Oval Hongo 18cm',
    cantidad: 1,
    motivo: 'sin_vincular',
    producto: lampara,
    ...cambios,
  }
}

describe('simular', () => {
  it('agrupa por producto aunque vengan de publicaciones distintas', () => {
    const sim = simular([
      linea({ itemId: 1, mlItemId: 'MLA111', cantidad: 2 }),
      linea({ itemId: 2, mlItemId: 'MLA222', cantidad: 1 }),
    ])

    expect(sim.productos).toEqual([
      { productoId: 7, nombre: 'Lámpara Hongo', stockActual: 3, aDescontar: 3, stockResultante: 0, viaKits: [] },
    ])
    expect(sim.conciliables).toHaveLength(2)
  })

  it('deja el stock negativo si no alcanza (la venta ya ocurrió)', () => {
    const sim = simular([linea({ cantidad: 5 })])
    expect(sim.productos[0].stockResultante).toBe(-2)
    expect(sim.conciliables).toHaveLength(1)
  })

  it('separa las líneas de publicaciones sin vincular', () => {
    const sim = simular([
      linea({ itemId: 1, producto: null, mlItemId: 'MLA999', titulo: 'Espejo', cantidad: 2 }),
      linea({ itemId: 2, producto: null, mlItemId: 'MLA999', titulo: 'Espejo', cantidad: 1 }),
    ])
    expect(sim.conciliables).toHaveLength(0)
    expect(sim.sinVincular).toEqual([{ mlItemId: 'MLA999', titulo: 'Espejo', lineas: 2, unidades: 3 }])
  })

  it('un kit descuenta sus componentes, no el kit', () => {
    const kit = {
      id: 50, nombre: 'Set living', stock: 0, es_kit: true,
      componentes: [
        { id: 7, nombre: 'Lámpara Hongo', stock: 3, cantidad: 2 },
        { id: 8, nombre: 'Almohadón', stock: 10, cantidad: 1 },
      ],
    }
    const sim = simular([linea({ producto: kit, cantidad: 2 }), linea({ itemId: 2, cantidad: 1 })])

    expect(sim.conciliables).toHaveLength(2)
    expect(sim.productos).toEqual([
      { productoId: 8, nombre: 'Almohadón', stockActual: 10, aDescontar: 2, stockResultante: 8, viaKits: ['Set living'] },
      { productoId: 7, nombre: 'Lámpara Hongo', stockActual: 3, aDescontar: 5, stockResultante: -2, viaKits: ['Set living'] },
    ])
  })

  it('incluye las ventas que no descontaron por stock insuficiente', () => {
    const sim = simular([linea({ motivo: 'stock_insuficiente', cantidad: 4 })])
    expect(sim.conciliables).toHaveLength(1)
    expect(sim.productos[0].stockResultante).toBe(-1)
  })
})

describe('aplicar', () => {
  function fakeRpc(respuestas: unknown[]) {
    const llamadas: unknown[] = []
    let i = 0
    const supabase = {
      async rpc(nombre: string, args: unknown) {
        llamadas.push({ nombre, args })
        return respuestas[i++] as { data: unknown; error: unknown }
      },
    }
    return { supabase: supabase as never, llamadas }
  }

  it('llama al RPC por línea y cuenta resultados', async () => {
    const { supabase, llamadas } = fakeRpc([
      { data: { ok: true, pedido_conciliado: true }, error: null },
      { data: { ok: false, motivo: 'ya_conciliado' }, error: null },
      { data: null, error: { message: 'boom' } },
    ])

    const r = await aplicar(supabase, [linea({ itemId: 1 }), linea({ itemId: 2 }), linea({ itemId: 3 })])

    expect(llamadas[0]).toEqual({ nombre: 'conciliar_item_ml', args: { p_item_id: 1, p_producto_id: 7 } })
    expect(r).toEqual({
      aplicadas: 1,
      yaConciliadas: 1,
      pedidosConciliados: 1,
      errores: [{ itemId: 3, motivo: 'boom' }],
    })
    expect(alertaMock).toHaveBeenCalledOnce()
  })

  it('una segunda corrida no descuenta nada ni alerta', async () => {
    const { supabase } = fakeRpc([{ data: { ok: false, motivo: 'ya_conciliado' }, error: null }])
    const r = await aplicar(supabase, [linea()])
    expect(r.aplicadas).toBe(0)
    expect(alertaMock).not.toHaveBeenCalled()
  })
})

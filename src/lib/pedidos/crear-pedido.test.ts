// Tests de regresión de crearPedidoCompleto().
//
// Objetivo: congelar el comportamiento que tenía use-nueva-venta.ts antes del
// refactor, para que la importación de órdenes de ML (PR2) pueda reusar el
// helper sin romper la venta directa, que es la que factura hoy.

import { describe, it, expect } from 'vitest'
import { crearPedidoCompleto, type CrearPedidoInput } from './crear-pedido'
import { crearFakeSupabase, insertDe } from '@/test/fake-supabase'

const FECHA = '2026-07-31T15:30:00.000Z'

function venta(cambios: Partial<CrearPedidoInput> = {}): CrearPedidoInput {
  return {
    cliente_id: 7,
    origen_venta: 'directa',
    canal_venta: 'directo',
    metodo_pago: 'efectivo',
    descuento_pct: 0,
    recargo_pct: 0,
    notas: '',
    fecha: FECHA,
    entrega_inmediata: false,
    items: [
      {
        producto_id: 42,
        nombre_producto: 'Espejo redondo',
        cantidad: 2,
        precio_unitario: 30000,
        costo_unitario: 12000,
        requiere_fabricacion: false,
      },
    ],
    pago: { tipo: 'pago_total', metodo_pago: 'efectivo', monto: 60000 },
    ...cambios,
  }
}

describe('crearPedidoCompleto — venta directa (regresión)', () => {
  it('crea pedido, items, pago y descuenta stock, en ese orden', async () => {
    const { supabase, registro } = crearFakeSupabase({ pedidoId: 555 })

    const resultado = await crearPedidoCompleto(supabase, venta())

    expect(resultado).toEqual({ ok: true, pedidoId: 555 })
    expect(registro.inserts.map(i => i.tabla)).toEqual([
      'pedidos',
      'items_pedido',
      'pagos_pedido',
    ])
    expect(registro.rpcs).toEqual([
      { nombre: 'descontar_stock_pedido', args: { p_pedido_id: 555 } },
    ])
  })

  it('el pedido nace confirmado y con las fechas de la venta', async () => {
    const { supabase, registro } = crearFakeSupabase()

    await crearPedidoCompleto(supabase, venta({ notas: 'Retira el martes' }))

    expect(insertDe(registro, 'pedidos')).toMatchObject({
      cliente_id: 7,
      origen_venta: 'directa',
      estado: 'confirmado',
      canal_venta: 'directo',
      metodo_pago: 'efectivo',
      recargo_pct: 0,
      notas: 'Retira el martes',
      fecha_pedido: FECHA,
      fecha_confirmacion: FECHA,
    })
  })

  it('manda notas null cuando vienen vacías', async () => {
    const { supabase, registro } = crearFakeSupabase()

    await crearPedidoCompleto(supabase, venta({ notas: '' }))

    expect(insertDe(registro, 'pedidos').notas).toBeNull()
  })

  it('redondea descuento_pct a dos decimales', async () => {
    const { supabase, registro } = crearFakeSupabase()

    await crearPedidoCompleto(supabase, venta({ descuento_pct: 13.336666 }))

    expect(insertDe(registro, 'pedidos').descuento_pct).toBe(13.34)
  })

  it('inserta los items enlazados al pedido creado', async () => {
    const { supabase, registro } = crearFakeSupabase({ pedidoId: 900 })

    await crearPedidoCompleto(supabase, venta({
      items: [
        { producto_id: 1, nombre_producto: 'Cuadro', cantidad: 3, precio_unitario: 10000, costo_unitario: 4000, requiere_fabricacion: true },
        { producto_id: null, nombre_producto: 'Envío', cantidad: 1, precio_unitario: 5000, costo_unitario: 0, requiere_fabricacion: false },
      ],
    }))

    expect(insertDe<unknown[]>(registro, 'items_pedido')).toEqual([
      { pedido_id: 900, producto_id: 1, nombre_producto: 'Cuadro', cantidad: 3, precio_unitario: 10000, costo_unitario: 4000, requiere_fabricacion: true },
      { pedido_id: 900, producto_id: null, nombre_producto: 'Envío', cantidad: 1, precio_unitario: 5000, costo_unitario: 0, requiere_fabricacion: false },
    ])
  })

  it('registra la seña como pago parcial', async () => {
    const { supabase, registro } = crearFakeSupabase({ pedidoId: 12 })

    await crearPedidoCompleto(supabase, venta({
      pago: { tipo: 'seña', metodo_pago: 'transferencia', monto: 20000 },
    }))

    expect(insertDe(registro, 'pagos_pedido')).toEqual({
      pedido_id: 12,
      tipo: 'seña',
      metodo_pago: 'transferencia',
      monto: 20000,
    })
  })

  it('no registra pago cuando lo cobra otro flujo (Point / link de MP)', async () => {
    const { supabase, registro } = crearFakeSupabase()

    const resultado = await crearPedidoCompleto(supabase, venta({ pago: null }))

    expect(resultado.ok).toBe(true)
    expect(registro.inserts.map(i => i.tabla)).not.toContain('pagos_pedido')
  })

  it('marca entregado solo después de descontar stock', async () => {
    const { supabase, registro } = crearFakeSupabase({ pedidoId: 77 })

    await crearPedidoCompleto(supabase, venta({ entrega_inmediata: true }))

    expect(insertDe(registro, 'pedidos').fecha_entrega).toBe(FECHA)
    expect(registro.updates).toEqual([
      { tabla: 'pedidos', payload: { estado: 'entregado' }, columna: 'id', valor: 77 },
    ])
    expect(registro.rpcs).toHaveLength(1)
  })

  it('no manda fecha_entrega si no es entrega inmediata', async () => {
    const { supabase, registro } = crearFakeSupabase()

    await crearPedidoCompleto(supabase, venta({ entrega_inmediata: false }))

    expect(insertDe(registro, 'pedidos')).not.toHaveProperty('fecha_entrega')
    expect(registro.updates).toEqual([])
  })
})

describe('crearPedidoCompleto — fallas', () => {
  it('rechaza un pedido sin items sin tocar la base', async () => {
    const { supabase, registro } = crearFakeSupabase()

    const resultado = await crearPedidoCompleto(supabase, venta({ items: [] }))

    expect(resultado).toEqual({
      ok: false,
      pedidoId: null,
      error: 'El pedido no tiene items',
    })
    expect(registro.inserts).toEqual([])
  })

  it('corta si falla el insert del pedido', async () => {
    const { supabase, registro } = crearFakeSupabase({
      erroresInsert: { pedidos: 'violates row-level security' },
    })

    const resultado = await crearPedidoCompleto(supabase, venta())

    expect(resultado).toEqual({
      ok: false,
      pedidoId: null,
      error: 'violates row-level security',
    })
    expect(registro.inserts.map(i => i.tabla)).toEqual(['pedidos'])
    expect(registro.rpcs).toEqual([])
  })

  it('corta si fallan los items, informando el pedido huérfano', async () => {
    const { supabase, registro } = crearFakeSupabase({
      pedidoId: 31,
      erroresInsert: { items_pedido: 'null value in column cantidad' },
    })

    const resultado = await crearPedidoCompleto(supabase, venta())

    expect(resultado).toEqual({
      ok: false,
      pedidoId: 31,
      error: 'null value in column cantidad',
    })
    expect(registro.rpcs).toEqual([])
  })

  it('corta si falla el pago, sin descontar stock', async () => {
    const { supabase, registro } = crearFakeSupabase({
      erroresInsert: { pagos_pedido: 'monto fuera de rango' },
    })

    const resultado = await crearPedidoCompleto(supabase, venta())

    expect(resultado.ok).toBe(false)
    expect(registro.rpcs).toEqual([])
  })

  it('propaga el error del RPC de stock', async () => {
    const { supabase } = crearFakeSupabase({
      pedidoId: 8,
      rpc: { data: null, error: { message: 'function does not exist' } },
    })

    const resultado = await crearPedidoCompleto(supabase, venta())

    expect(resultado).toEqual({
      ok: false,
      pedidoId: 8,
      error: 'function does not exist',
    })
  })

  it('con stock insuficiente conserva el pedido y NO lo da por entregado', async () => {
    const { supabase, registro } = crearFakeSupabase({
      pedidoId: 64,
      rpc: { data: { ok: false, errores: [{ producto_id: 42, falta: 1 }] }, error: null },
    })

    const resultado = await crearPedidoCompleto(
      supabase,
      venta({ entrega_inmediata: true })
    )

    expect(resultado).toMatchObject({
      ok: false,
      pedidoId: 64,
      stockInsuficiente: true,
      erroresStock: [{ producto_id: 42, falta: 1 }],
    })
    // La venta ya ocurrió: el pedido queda, pero no se marca entregado.
    expect(registro.updates).toEqual([])
  })
})

describe('crearPedidoCompleto — campos de Mercado Libre', () => {
  it('omite las columnas de ML cuando el llamador no las usa', async () => {
    const { supabase, registro } = crearFakeSupabase()

    await crearPedidoCompleto(supabase, venta())

    // Importante: la venta directa tiene que seguir insertando exactamente las
    // mismas columnas que antes del refactor, incluso si todavía no se corrió
    // la migración de ML en la base.
    const pedido = insertDe(registro, 'pedidos')
    expect(pedido).not.toHaveProperty('ml_order_id')
    expect(pedido).not.toHaveProperty('conciliado')
  })

  it('manda ml_order_id y conciliado cuando el pedido viene de ML', async () => {
    const { supabase, registro } = crearFakeSupabase()

    await crearPedidoCompleto(supabase, venta({
      canal_venta: 'mercadolibre',
      ml_order_id: '2000012345678',
      conciliado: false,
      pago: {
        tipo: 'pago_total',
        metodo_pago: 'mercadopago',
        monto: 60000,
        comisiones: 7800,
        notas: 'Orden ML 2000012345678',
      },
    }))

    expect(insertDe(registro, 'pedidos')).toMatchObject({
      canal_venta: 'mercadolibre',
      ml_order_id: '2000012345678',
      conciliado: false,
    })
    expect(insertDe(registro, 'pagos_pedido')).toMatchObject({
      comisiones: 7800,
      notas: 'Orden ML 2000012345678',
    })
  })
})

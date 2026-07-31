// src/lib/pedidos/crear-pedido.ts
//
// Flujo canónico de creación de un pedido: pedido → items → pago → stock.
//
// Vive acá (y no en un hook) porque lo necesitan dos llamadores con clientes
// de Supabase distintos: la venta directa desde el browser (anon + cookies) y
// la importación de órdenes de ML desde un webhook (service-role, sin cookies).
// Por eso el cliente entra por parámetro en vez de crearse adentro.
//
// No tira excepciones para fallas esperables: devuelve un resultado que el
// llamador decide cómo mostrar (setError en la UI, fila en ml_importaciones
// en el webhook). Cero fallas silenciosas.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CanalVenta, MetodoPago } from '@/lib/types'

export interface ItemPedidoNuevo {
  producto_id: number | null
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  costo_unitario: number
  requiere_fabricacion: boolean
}

export interface PagoInicial {
  tipo: 'seña' | 'adelanto' | 'saldo' | 'pago_total'
  metodo_pago: MetodoPago
  monto: number
  /** Lo que retuvo la plataforma (MP o ML). Las vistas lo restan del ingreso neto. */
  comisiones?: number
  notas?: string
}

export interface CrearPedidoInput {
  cliente_id: number | null
  origen_venta: 'presupuesto' | 'directa'
  canal_venta: CanalVenta
  metodo_pago: MetodoPago
  descuento_pct: number
  recargo_pct: number
  notas?: string | null
  /** Timestamp ISO. Se usa como fecha_pedido y fecha_confirmacion. */
  fecha: string
  /** Si es true, el pedido pasa a 'entregado' después de descontar stock. */
  entrega_inmediata: boolean
  items: ItemPedidoNuevo[]
  /**
   * Pago a registrar junto con el pedido, o null si lo registra otro flujo
   * (link de MP, asignación de un pago del Point).
   */
  pago?: PagoInicial | null
  /** Solo para pedidos importados de Mercado Libre. Clave de idempotencia. */
  ml_order_id?: string
  /** false = algún item no matcheó un producto interno (pedido a revisar). */
  conciliado?: boolean
}

export type CrearPedidoResultado =
  /** Pedido creado y stock descontado. */
  | { ok: true; pedidoId: number }
  /**
   * El pedido SÍ se creó, pero no se pudo descontar el stock. No es un rollback:
   * la venta ya ocurrió en el mundo real y perderla sería peor que tener el
   * stock desfasado. El llamador avisa para que se corrija a mano.
   */
  | { ok: false; pedidoId: number; error: string; stockInsuficiente: true; erroresStock: unknown }
  /** Falló antes o durante la creación. pedidoId es null si no llegó a existir. */
  | { ok: false; pedidoId: number | null; error: string; stockInsuficiente?: false }

export async function crearPedidoCompleto(
  supabase: SupabaseClient,
  input: CrearPedidoInput
): Promise<CrearPedidoResultado> {
  if (input.items.length === 0) {
    return { ok: false, pedidoId: null, error: 'El pedido no tiene items' }
  }

  // ── 1. Pedido ─────────────────────────────────────────────
  // Siempre nace 'confirmado': el RPC de stock descuenta sobre pedidos
  // confirmados. El paso a 'entregado' va al final (paso 4).
  const { data: pedido, error: errPedido } = await supabase
    .from('pedidos')
    .insert({
      cliente_id: input.cliente_id,
      origen_venta: input.origen_venta,
      estado: 'confirmado',
      canal_venta: input.canal_venta,
      metodo_pago: input.metodo_pago,
      descuento_pct: Math.round(input.descuento_pct * 100) / 100,
      recargo_pct: input.recargo_pct,
      notas: input.notas || null,
      fecha_pedido: input.fecha,
      fecha_confirmacion: input.fecha,
      ...(input.entrega_inmediata ? { fecha_entrega: input.fecha } : {}),
      // Las columnas de ML solo se mandan si el llamador las usa, así el
      // insert de la venta directa queda idéntico al de antes del refactor.
      ...(input.ml_order_id !== undefined ? { ml_order_id: input.ml_order_id } : {}),
      ...(input.conciliado !== undefined ? { conciliado: input.conciliado } : {}),
    })
    .select('id')
    .single()

  if (errPedido || !pedido) {
    return { ok: false, pedidoId: null, error: errPedido?.message ?? 'Error al crear el pedido' }
  }

  // ── 2. Items ──────────────────────────────────────────────
  const { error: errItems } = await supabase
    .from('items_pedido')
    .insert(
      input.items.map(item => ({
        pedido_id: pedido.id,
        producto_id: item.producto_id,
        nombre_producto: item.nombre_producto,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        costo_unitario: item.costo_unitario,
        requiere_fabricacion: item.requiere_fabricacion,
      }))
    )

  if (errItems) {
    return { ok: false, pedidoId: pedido.id, error: errItems.message }
  }

  // ── 3. Pago (opcional) ────────────────────────────────────
  if (input.pago) {
    const { error: errPago } = await supabase
      .from('pagos_pedido')
      .insert({
        pedido_id: pedido.id,
        tipo: input.pago.tipo,
        metodo_pago: input.pago.metodo_pago,
        monto: input.pago.monto,
        ...(input.pago.comisiones !== undefined ? { comisiones: input.pago.comisiones } : {}),
        ...(input.pago.notas !== undefined ? { notas: input.pago.notas } : {}),
      })

    if (errPago) {
      return { ok: false, pedidoId: pedido.id, error: errPago.message }
    }
  }

  // ── 4. Stock ──────────────────────────────────────────────
  const { data: resultado, error: errRpc } = await supabase
    .rpc('descontar_stock_pedido', { p_pedido_id: pedido.id })

  if (errRpc) {
    return { ok: false, pedidoId: pedido.id, error: errRpc.message }
  }

  if (resultado && !resultado.ok) {
    return {
      ok: false,
      pedidoId: pedido.id,
      error: `Stock insuficiente: ${JSON.stringify(resultado.errores)}`,
      stockInsuficiente: true,
      erroresStock: resultado.errores,
    }
  }

  // ── 5. Entrega inmediata ──────────────────────────────────
  // Después del stock a propósito: si el stock falló, el pedido no puede
  // darse por entregado.
  if (input.entrega_inmediata) {
    const { error: errEntrega } = await supabase
      .from('pedidos')
      .update({ estado: 'entregado' })
      .eq('id', pedido.id)

    if (errEntrega) {
      return { ok: false, pedidoId: pedido.id, error: errEntrega.message }
    }
  }

  return { ok: true, pedidoId: pedido.id }
}

// src/lib/ml/importar-orden.ts
//
// T4 — Traducción de una orden de Mercado Libre a un pedido del sistema.
//
// Separado del route handler a propósito: acá está toda la lógica que decide
// qué se guarda, y se puede testear sin levantar un servidor ni tocar la red.

import type { SupabaseClient } from '@supabase/supabase-js'
import { crearPedidoCompleto, type ItemPedidoNuevo } from '@/lib/pedidos/crear-pedido'
import { enviarAlerta } from './alertas'
import type { OrdenML, ResultadoImportacion } from './types'

export interface ResultadoImportar {
  resultado: ResultadoImportacion
  pedidoId: number | null
  detalle: string
}

/** Estados en los que la plata está: recién ahí importamos y movemos stock. */
const ESTADOS_IMPORTABLES: ReadonlySet<string> = new Set(['paid'])

/**
 * Comisión total de ML: la suma de sale_fee de cada item.
 * Ojo — ML calcula sale_fee al acreditar el pago, así que en una orden recién
 * creada puede venir 0 y completarse más tarde.
 */
export function calcularComision(orden: OrdenML): number {
  return orden.order_items.reduce((total, item) => total + (item.sale_fee ?? 0), 0)
}

/** Cliente genérico: no ensuciamos la tabla de clientes con nicknames de ML. */
function notasDeOrden(orden: OrdenML): string {
  const comprador = orden.buyer?.nickname ?? 'sin nickname'
  return `Orden ML #${orden.id} · Comprador: ${comprador}`
}

/**
 * Busca los productos internos que corresponden a las publicaciones de la orden.
 * Devuelve un mapa ml_item_id → { producto_id, costo }.
 */
async function matchearProductos(
  supabase: SupabaseClient,
  orden: OrdenML
): Promise<Map<string, { id: number; costo: number }>> {
  const idsPublicaciones = [...new Set(orden.order_items.map(i => i.item.id))]

  const { data, error } = await supabase
    .from('productos')
    .select('id, costo, ml_item_id')
    .in('ml_item_id', idsPublicaciones)

  if (error) throw new Error(`Error buscando productos por ml_item_id: ${error.message}`)

  const mapa = new Map<string, { id: number; costo: number }>()
  for (const fila of data ?? []) {
    if (fila.ml_item_id) mapa.set(fila.ml_item_id, { id: fila.id, costo: fila.costo ?? 0 })
  }
  return mapa
}

/**
 * Importa una orden ya validada contra la API de ML.
 *
 * Idempotente: si el ml_order_id ya existe, no hace nada y devuelve 'duplicada'.
 * ML reenvía la misma notificación varias veces, así que esto no es un caso
 * raro sino el camino habitual.
 */
export async function importarOrden(
  supabase: SupabaseClient,
  orden: OrdenML
): Promise<ResultadoImportar> {
  const mlOrderId = String(orden.id)

  // ── Estado: antes de 'paid' no se toca nada ────────────────
  if (!ESTADOS_IMPORTABLES.has(orden.status)) {
    return {
      resultado: 'ignorada',
      pedidoId: null,
      detalle: `Orden en estado "${orden.status}": se ignora hasta que esté paga.`,
    }
  }

  if (orden.order_items.length === 0) {
    await enviarAlerta({
      nivel: 'atencion',
      titulo: 'Orden de ML sin items',
      detalle: `La orden ${mlOrderId} llegó sin items y no se pudo importar.`,
      contexto: { ml_order_id: mlOrderId },
    })
    return { resultado: 'error', pedidoId: null, detalle: 'La orden no tiene items' }
  }

  // ── Idempotencia (chequeo previo) ──────────────────────────
  // El UNIQUE de la base es la garantía real; esto solo evita trabajo inútil
  // en el caso normal de notificación repetida.
  const { data: existente, error: errExistente } = await supabase
    .from('pedidos')
    .select('id')
    .eq('ml_order_id', mlOrderId)
    .maybeSingle()

  if (errExistente) {
    throw new Error(`Error chequeando idempotencia: ${errExistente.message}`)
  }

  if (existente) {
    return {
      resultado: 'duplicada',
      pedidoId: existente.id,
      detalle: `La orden ya estaba importada como pedido #${existente.id}.`,
    }
  }

  // ── Match de productos ─────────────────────────────────────
  const productos = await matchearProductos(supabase, orden)
  const sinMatch: string[] = []

  const items: ItemPedidoNuevo[] = orden.order_items.map(linea => {
    const producto = productos.get(linea.item.id)
    if (!producto) sinMatch.push(`${linea.item.id} (${linea.item.title})`)

    return {
      // Sin match dejamos producto_id null: el pedido entra igual (la venta ya
      // ocurrió) pero no descuenta stock de un producto que no sabemos cuál es.
      producto_id: producto?.id ?? null,
      nombre_producto: linea.item.title,
      cantidad: linea.quantity,
      precio_unitario: linea.unit_price,
      costo_unitario: producto?.costo ?? 0,
      requiere_fabricacion: false,
    }
  })

  const conciliado = sinMatch.length === 0
  const comision = calcularComision(orden)
  const fecha = orden.date_closed ?? orden.date_created

  // ── Alta del pedido ────────────────────────────────────────
  const creacion = await crearPedidoCompleto(supabase, {
    cliente_id: null,
    origen_venta: 'directa',
    canal_venta: 'mercadolibre',
    metodo_pago: 'mercadopago',
    descuento_pct: 0,
    recargo_pct: 0,
    notas: notasDeOrden(orden),
    fecha,
    // ML entrega por Mercado Envíos; el pedido nace confirmado y el estado de
    // envío se seguirá cuando se implemente el módulo de envíos (diferido).
    entrega_inmediata: false,
    items,
    pago: {
      tipo: 'pago_total',
      metodo_pago: 'mercadopago',
      monto: orden.total_amount,
      comisiones: comision,
      notas: `Orden ML #${orden.id} · Comisión ML $${comision}`,
    },
    ml_order_id: mlOrderId,
    conciliado,
  })

  // ── Interpretación del resultado ───────────────────────────
  if (!creacion.ok && creacion.stockInsuficiente) {
    // La venta ya pasó en ML: el pedido queda y se avisa para corregir a mano.
    await enviarAlerta({
      nivel: 'atencion',
      titulo: 'Venta de ML sin stock suficiente',
      detalle: `Se importó la orden ${mlOrderId} como pedido #${creacion.pedidoId}, pero no alcanzó el stock. Revisá el inventario.`,
      contexto: { ml_order_id: mlOrderId, pedido_id: creacion.pedidoId, errores: creacion.erroresStock },
    })
    return {
      resultado: conciliado ? 'importada' : 'sin_conciliar',
      pedidoId: creacion.pedidoId,
      detalle: `Importada con stock insuficiente: ${creacion.error}`,
    }
  }

  if (!creacion.ok) {
    // Si el UNIQUE de ml_order_id saltó acá, es una carrera con otra
    // notificación simultánea: la otra ya la importó, así que no es un error.
    if (/duplicate key|unique constraint/i.test(creacion.error)) {
      return {
        resultado: 'duplicada',
        pedidoId: creacion.pedidoId,
        detalle: 'Otra notificación simultánea ya había importado la orden.',
      }
    }

    await enviarAlerta({
      nivel: 'critico',
      titulo: 'No se pudo importar una venta de ML',
      detalle: `La orden ${mlOrderId} falló al importarse: ${creacion.error}`,
      contexto: { ml_order_id: mlOrderId, pedido_id: creacion.pedidoId },
    })
    return { resultado: 'error', pedidoId: creacion.pedidoId, detalle: creacion.error }
  }

  if (!conciliado) {
    await enviarAlerta({
      nivel: 'atencion',
      titulo: 'Venta de ML sin conciliar',
      detalle: `El pedido #${creacion.pedidoId} entró pero estas publicaciones no matchean ningún producto: ${sinMatch.join(', ')}. No se descontó su stock.`,
      contexto: { ml_order_id: mlOrderId, pedido_id: creacion.pedidoId, sin_match: sinMatch },
    })
    return {
      resultado: 'sin_conciliar',
      pedidoId: creacion.pedidoId,
      detalle: `Publicaciones sin producto asociado: ${sinMatch.join(', ')}`,
    }
  }

  return {
    resultado: 'importada',
    pedidoId: creacion.pedidoId,
    detalle: `Pedido #${creacion.pedidoId} creado desde la orden ${mlOrderId}.`,
  }
}

/** Deja constancia en la tabla de auditoría. Nunca tira: es observabilidad. */
export async function registrarImportacion(
  supabase: SupabaseClient,
  datos: {
    mlOrderId: string
    resultado: ResultadoImportacion
    pedidoId?: number | null
    detalle?: string
    payload?: unknown
  }
): Promise<void> {
  const { error } = await supabase.from('ml_importaciones').insert({
    ml_order_id: datos.mlOrderId,
    resultado: datos.resultado,
    pedido_id: datos.pedidoId ?? null,
    detalle: datos.detalle ?? null,
    payload: datos.payload ?? null,
  })

  if (error) {
    console.error('[ml] no se pudo registrar la importación:', error.message, datos)
  }
}

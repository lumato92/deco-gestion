// src/lib/ml/importar-orden.ts
//
// T4 — Traducción de una orden de Mercado Libre a un pedido del sistema.
//
// Separado del route handler a propósito: acá está toda la lógica que decide
// qué se guarda, y se puede testear sin levantar un servidor ni tocar la red.

import type { SupabaseClient } from '@supabase/supabase-js'
import { crearPedidoCompleto, type ItemPedidoNuevo } from '@/lib/pedidos/crear-pedido'
import { costoEnvioVendedor } from './client'
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
 * Comisión total de ML.
 *
 * `sale_fee` es POR UNIDAD, así que va multiplicado por la cantidad. Verificado
 * contra ventas reales: dos órdenes del mismo producto, de 2 y de 4 unidades,
 * traen el mismo sale_fee. Sumarlo sin multiplicar subestimaba la comisión e
 * inflaba la ganancia (en una venta de 4 unidades, por un factor de 4).
 */
export function calcularComision(orden: OrdenML): number {
  return orden.order_items.reduce(
    (total, item) => total + (item.sale_fee ?? 0) * (item.quantity ?? 1),
    0
  )
}

/** Impuestos informados por ML. Hoy vienen null en las ventas reales. */
export function calcularImpuestos(orden: OrdenML): number {
  const deLaOrden = orden.taxes?.amount ?? 0
  const deLosPagos = (orden.payments ?? []).reduce(
    (t, p) => t + (p.taxes_amount ?? 0),
    0
  )
  return deLaOrden + deLosPagos
}

export interface CostosOrden {
  comision: number
  envio: number
  impuestos: number
  /** Lo que se descuenta del ingreso: comisión + envío + impuestos. */
  total: number
}

/**
 * Todo lo que ML se queda de una venta.
 *
 * El envío requiere una consulta extra a /shipments/{id}/costs. Si esa
 * consulta falla NO se pierde la venta: se registra lo que sí sabemos y se
 * alerta, porque una ganancia con el envío sin descontar es mejor que no
 * tener la venta — pero hay que enterarse.
 */
export async function calcularCostos(
  supabase: SupabaseClient,
  orden: OrdenML,
  sellerId?: string
): Promise<CostosOrden> {
  const comision = calcularComision(orden)
  const impuestos = calcularImpuestos(orden)

  let envio = 0
  const shipmentId = orden.shipping?.id
  if (shipmentId) {
    try {
      envio = await costoEnvioVendedor(supabase, shipmentId, sellerId ?? (orden.seller ? String(orden.seller.id) : undefined))
    } catch (e) {
      await enviarAlerta({
        nivel: 'atencion',
        titulo: 'No se pudo leer el costo de envío de una venta de ML',
        detalle: `La orden ${orden.id} se importa sin descontar el flete, así que su ganancia va a figurar más alta de lo real. Revisala a mano.`,
        contexto: { ml_order_id: String(orden.id), shipment_id: shipmentId, error: e instanceof Error ? e.message : String(e) },
      })
    }
  }

  return { comision, envio, impuestos, total: comision + envio + impuestos }
}

/** Cliente genérico: no ensuciamos la tabla de clientes con nicknames de ML. */
function notasDeOrden(orden: OrdenML): string {
  const comprador = orden.buyer?.nickname ?? 'sin nickname'
  return `Orden ML #${orden.id} · Comprador: ${comprador}`
}

/**
 * Busca los productos internos que corresponden a las publicaciones de la orden.
 * Devuelve un mapa ml_item_id → { producto_id, costo }.
 *
 * Pasa por `ml_publicaciones` porque la relación es muchos a uno: el mismo
 * producto puede estar publicado varias veces (por ejemplo, una publicación
 * con cuotas y otra sin), y todas tienen que descontar del mismo stock.
 */
async function matchearProductos(
  supabase: SupabaseClient,
  orden: OrdenML
): Promise<Map<string, { id: number; costo: number }>> {
  const idsPublicaciones = [...new Set(orden.order_items.map(i => i.item.id))]

  const { data: vinculos, error: errVinculos } = await supabase
    .from('ml_publicaciones')
    .select('ml_item_id, producto_id')
    .in('ml_item_id', idsPublicaciones)

  if (errVinculos) {
    throw new Error(`Error buscando publicaciones de ML: ${errVinculos.message}`)
  }

  const mapa = new Map<string, { id: number; costo: number }>()
  if (!vinculos?.length) return mapa

  const idsProductos = [...new Set(vinculos.map(v => v.producto_id))]
  const { data: productos, error: errProductos } = await supabase
    .from('productos')
    .select('id, costo')
    .in('id', idsProductos)

  if (errProductos) {
    throw new Error(`Error buscando productos: ${errProductos.message}`)
  }

  const costos = new Map<number, number>()
  for (const p of productos ?? []) costos.set(p.id, p.costo ?? 0)

  for (const v of vinculos) {
    // Un vínculo que apunta a un producto borrado se ignora: mejor que entre
    // sin conciliar y con alerta, a que reviente la importación.
    if (costos.has(v.producto_id)) {
      mapa.set(v.ml_item_id, { id: v.producto_id, costo: costos.get(v.producto_id)! })
    }
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
  orden: OrdenML,
  opciones: { sellerId?: string } = {}
): Promise<ResultadoImportar> {
  const mlOrderId = String(orden.id)

  // ── Estado: antes de 'paid' no se toca nada ────────────────
  if (!ESTADOS_IMPORTABLES.has(orden.status)) {
    if (orden.status === 'cancelled') {
      return manejarCancelada(supabase, orden, opciones.sellerId)
    }

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
  const costos = await calcularCostos(supabase, orden, opciones.sellerId)
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
      // Cada concepto en su columna: las vistas suman los tres en `deducciones`
      // y el panel de comisiones los muestra desglosados.
      comisiones: costos.comision,
      costo_envio: costos.envio,
      impuestos: costos.impuestos,
      notas:
        `Orden ML #${orden.id} · Comisión $${costos.comision}` +
        ` · Envío $${costos.envio}` +
        (costos.impuestos ? ` · Impuestos $${costos.impuestos}` : ''),
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

/**
 * Orden cancelada.
 *
 * Dos cosas pueden pasar y ninguna es automática:
 *
 * 1. El envío se despachó igual. ML factura el flete aunque la venta se caiga
 *    (caso real: orden 2000017275632908). Ese costo no tiene pedido al que
 *    atribuirse, así que se registra como gasto de categoría Flete.
 *
 * 2. La orden ya se había importado como pedido. No se cancela sola: mapear
 *    los estados de devolución de ML es un tema aparte, y cancelar un pedido
 *    por las nuestras puede desarmar stock y cobranzas. Se alerta para que
 *    lo revise una persona.
 */
async function manejarCancelada(
  supabase: SupabaseClient,
  orden: OrdenML,
  sellerId?: string
): Promise<ResultadoImportar> {
  const mlOrderId = String(orden.id)

  // ¿Ya la habíamos importado como venta?
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id')
    .eq('ml_order_id', mlOrderId)
    .maybeSingle()

  if (pedido) {
    await enviarAlerta({
      nivel: 'atencion',
      titulo: 'Se canceló una venta de ML que ya estaba importada',
      detalle: `La orden ${mlOrderId} figura cancelada en Mercado Libre, pero acá quedó como pedido #${pedido.id}. Revisalo y cancelalo a mano si corresponde: no se toca solo para no desarmar stock ni cobranzas.`,
      contexto: { ml_order_id: mlOrderId, pedido_id: pedido.id },
    })
  }

  // ¿Nos cobraron el flete igual?
  let flete = 0
  if (orden.shipping?.id) {
    try {
      flete = await costoEnvioVendedor(
        supabase,
        orden.shipping.id,
        sellerId ?? (orden.seller ? String(orden.seller.id) : undefined)
      )
    } catch {
      // Sin dato de flete no inventamos un gasto.
      flete = 0
    }
  }

  if (flete <= 0) {
    return {
      resultado: 'ignorada',
      pedidoId: pedido?.id ?? null,
      detalle: 'Orden cancelada sin costo de envío a cargo del vendedor.',
    }
  }

  // Idempotencia: el backfill se puede correr de nuevo y ML reenvía avisos.
  const { data: gastoExistente } = await supabase
    .from('gastos')
    .select('id')
    .eq('ml_order_id', mlOrderId)
    .maybeSingle()

  if (gastoExistente) {
    return {
      resultado: 'duplicada',
      pedidoId: pedido?.id ?? null,
      detalle: `El flete de la orden cancelada ya estaba registrado como gasto #${gastoExistente.id}.`,
    }
  }

  const fecha = (orden.date_closed ?? orden.date_created).slice(0, 10)

  const { error } = await supabase.from('gastos').insert({
    categoria: 'Flete',
    descripcion: `Flete de venta cancelada en Mercado Libre · Orden ${mlOrderId}`,
    monto: flete,
    fecha,
    recurrente: false,
    metodo_pago: 'mercadopago',
    origen: 'ml',
    ml_order_id: mlOrderId,
    notas:
      `La venta se canceló pero el envío se despachó igual, así que ML facturó el flete. ` +
      `No tiene pedido asociado porque la venta no llegó a concretarse. ` +
      `Operación de Mercado Libre: ${mlOrderId}.`,
  })

  if (error) {
    if (/duplicate key|unique constraint/i.test(error.message)) {
      return {
        resultado: 'duplicada',
        pedidoId: pedido?.id ?? null,
        detalle: 'Otro proceso ya registró el flete de esta orden cancelada.',
      }
    }

    await enviarAlerta({
      nivel: 'atencion',
      titulo: 'No se pudo registrar el flete de una venta cancelada de ML',
      detalle: `La orden ${mlOrderId} se canceló con un flete de $${flete} a tu cargo, pero no se pudo cargar el gasto: ${error.message}`,
      contexto: { ml_order_id: mlOrderId, monto: flete },
    })
    return { resultado: 'error', pedidoId: pedido?.id ?? null, detalle: error.message }
  }

  await enviarAlerta({
    nivel: 'info',
    titulo: 'Flete de venta cancelada registrado como gasto',
    detalle: `La orden ${mlOrderId} se canceló pero el envío se despachó: se cargó un gasto de Flete por $${flete}.`,
    contexto: { ml_order_id: mlOrderId, monto: flete },
  })

  return {
    resultado: 'importada',
    pedidoId: pedido?.id ?? null,
    detalle: `Venta cancelada: se registró el flete de $${flete} como gasto.`,
  }
}

export interface Previsualizacion {
  mlOrderId: string
  estado: string
  /** true si el importador la tomaría (está paga y tiene items). */
  importable: boolean
  yaImportada: boolean
  pedidoExistente: number | null
  /** Publicaciones que no matchean ningún producto interno. */
  sinMatch: string[]
  total: number
  comision: number
  envio: number
  impuestos: number
  /** comisión + envío + impuestos: lo que se descuenta del ingreso. */
  costoTotal: number
  /** Lo que realmente te queda: total - costoTotal. */
  neto: number
  /**
   * Venta cancelada cuyo envío se despachó igual: entra como gasto de Flete,
   * no como pedido. 0 en el resto de los casos.
   */
  gastoFlete: number
  fecha: string
}

/**
 * Qué pasaría si importáramos esta orden, sin escribir nada.
 *
 * Es lo que hace usable el backfill sobre ventas reales: antes de meter un mes
 * entero de pedidos conviene ver cuántos van a entrar sin conciliar por falta
 * de ml_item_id, y arreglar el mapeo primero.
 */
export async function previsualizarOrden(
  supabase: SupabaseClient,
  orden: OrdenML,
  opciones: { sellerId?: string } = {}
): Promise<Previsualizacion> {
  const mlOrderId = String(orden.id)

  const { data: existente } = await supabase
    .from('pedidos')
    .select('id')
    .eq('ml_order_id', mlOrderId)
    .maybeSingle()

  const importable =
    ESTADOS_IMPORTABLES.has(orden.status) && orden.order_items.length > 0

  let sinMatch: string[] = []
  if (importable && !existente) {
    const productos = await matchearProductos(supabase, orden)
    sinMatch = orden.order_items
      .filter(l => !productos.has(l.item.id))
      .map(l => `${l.item.id} (${l.item.title})`)
  }

  const costos = await calcularCostos(supabase, orden, opciones.sellerId)

  return {
    mlOrderId,
    estado: orden.status,
    importable,
    yaImportada: Boolean(existente),
    pedidoExistente: existente?.id ?? null,
    sinMatch,
    total: orden.total_amount,
    comision: costos.comision,
    envio: costos.envio,
    impuestos: costos.impuestos,
    costoTotal: costos.total,
    neto: orden.total_amount - costos.total,
    gastoFlete: orden.status === 'cancelled' ? costos.envio : 0,
    fecha: orden.date_closed ?? orden.date_created,
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

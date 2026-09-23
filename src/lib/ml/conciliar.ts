// src/lib/ml/conciliar.ts
//
// Conciliación de stock de ventas de ML que entraron sin producto asociado.
//
// Mientras una publicación no está vinculada (ml_publicaciones), sus ventas
// entran con producto_id = null y no descuentan stock. Cuando se vincula, esas
// ventas viejas quedan pendientes: acá se buscan, se simula cuánto baja cada
// stock y, confirmado, se descuenta línea por línea con el RPC
// conciliar_item_ml (idempotente: nunca descuenta dos veces la misma línea).
//
// Si no alcanza el stock se descuenta igual y queda negativo: la venta ya
// ocurrió en ML (decisión de negocio).

import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchOrden } from './client'
import { enviarAlerta } from './alertas'

export interface ProductoConciliable {
  id: number
  nombre: string
  stock: number
  es_kit: boolean
}

export interface LineaPendiente {
  itemId: number
  pedidoId: number
  mlOrderId: string
  fecha: string
  /** null si no se pudo saber de qué publicación vino. */
  mlItemId: string | null
  titulo: string
  cantidad: number
  /** Producto vinculado a la publicación, o null si todavía no se vinculó. */
  producto: ProductoConciliable | null
}

interface FilaItem {
  id: number
  pedido_id: number
  ml_item_id: string | null
  nombre_producto: string
  cantidad: number
  pedidos: { ml_order_id: string | null; fecha_pedido: string; estado: string }
}

/**
 * Completa ml_item_id de las líneas que no lo tienen, releyendo la orden en ML.
 * Solo pasa con ventas importadas antes de guardar la columna y cuyo payload
 * no quedó en ml_importaciones. Matchea por título, como la migración.
 */
async function completarOrigen(
  supabase: SupabaseClient,
  filas: FilaItem[],
  sellerId?: string
): Promise<void> {
  const porOrden = new Map<string, FilaItem[]>()
  for (const f of filas) {
    const orden = f.pedidos.ml_order_id
    if (f.ml_item_id || !orden) continue
    porOrden.set(orden, [...(porOrden.get(orden) ?? []), f])
  }

  for (const [mlOrderId, lineas] of porOrden) {
    const orden = await fetchOrden(supabase, mlOrderId, sellerId).catch(() => null)
    if (!orden) continue

    for (const linea of lineas) {
      const match = orden.order_items.find(oi => oi.item.title === linea.nombre_producto)
      if (!match) continue

      const { error } = await supabase
        .from('items_pedido')
        .update({ ml_item_id: match.item.id })
        .eq('id', linea.id)

      if (!error) linea.ml_item_id = match.item.id
    }
  }
}

/**
 * Líneas de ventas ML sin producto, con el producto al que apuntaría su
 * publicación si ya está vinculada. Excluye pedidos cancelados.
 */
export async function buscarPendientes(
  supabase: SupabaseClient,
  opciones: { mlItemId?: string; sellerId?: string } = {}
): Promise<LineaPendiente[]> {
  let consulta = supabase
    .from('items_pedido')
    .select('id, pedido_id, ml_item_id, nombre_producto, cantidad, pedidos!inner(ml_order_id, fecha_pedido, estado, canal_venta)')
    .is('producto_id', null)
    .eq('pedidos.canal_venta', 'mercadolibre')
    .neq('pedidos.estado', 'cancelado')

  if (opciones.mlItemId) consulta = consulta.eq('ml_item_id', opciones.mlItemId)

  const { data, error } = await consulta
  if (error) throw new Error(`Error buscando ventas pendientes: ${error.message}`)

  const filas = (data ?? []) as unknown as FilaItem[]
  if (!opciones.mlItemId) await completarOrigen(supabase, filas, opciones.sellerId)

  const idsPublicaciones = [...new Set(filas.map(f => f.ml_item_id).filter((x): x is string => Boolean(x)))]
  const productoDe = new Map<string, ProductoConciliable>()

  if (idsPublicaciones.length) {
    const { data: vinculos, error: errV } = await supabase
      .from('ml_publicaciones')
      .select('ml_item_id, productos(id, nombre, stock, es_kit)')
      .in('ml_item_id', idsPublicaciones)

    if (errV) throw new Error(`Error buscando vínculos: ${errV.message}`)

    for (const v of (vinculos ?? []) as unknown as { ml_item_id: string; productos: ProductoConciliable | null }[]) {
      if (v.productos) productoDe.set(v.ml_item_id, v.productos)
    }
  }

  return filas
    .map(f => ({
      itemId: f.id,
      pedidoId: f.pedido_id,
      mlOrderId: f.pedidos.ml_order_id ?? '',
      fecha: f.pedidos.fecha_pedido,
      mlItemId: f.ml_item_id,
      titulo: f.nombre_producto,
      cantidad: f.cantidad,
      producto: f.ml_item_id ? productoDe.get(f.ml_item_id) ?? null : null,
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export interface ImpactoProducto {
  productoId: number
  nombre: string
  esKit: boolean
  stockActual: number
  aDescontar: number
  stockResultante: number
  lineas: number
}

export interface Simulacion {
  /** Lo que se va a descontar, agrupado por producto. */
  productos: ImpactoProducto[]
  /** Líneas que se pueden conciliar ya. */
  conciliables: LineaPendiente[]
  /** Líneas cuya publicación todavía no está vinculada (o no se sabe cuál es). */
  sinVincular: { mlItemId: string | null; titulo: string; lineas: number; unidades: number }[]
}

/** Qué pasaría al conciliar, sin escribir nada. Pura: testeable sin base. */
export function simular(pendientes: LineaPendiente[]): Simulacion {
  const productos = new Map<number, ImpactoProducto>()
  const sinVincular = new Map<string, Simulacion['sinVincular'][number]>()
  const conciliables: LineaPendiente[] = []

  for (const l of pendientes) {
    if (!l.producto) {
      const clave = l.mlItemId ?? `?${l.titulo}`
      const g = sinVincular.get(clave) ?? { mlItemId: l.mlItemId, titulo: l.titulo, lineas: 0, unidades: 0 }
      g.lineas++
      g.unidades += l.cantidad
      sinVincular.set(clave, g)
      continue
    }

    const p = productos.get(l.producto.id) ?? {
      productoId: l.producto.id,
      nombre: l.producto.nombre,
      esKit: l.producto.es_kit,
      stockActual: l.producto.stock,
      aDescontar: 0,
      stockResultante: l.producto.stock,
      lineas: 0,
    }
    p.lineas++
    // Los kits no se concilian automáticamente (el RPC los rechaza): se
    // muestran para que se vean, pero no suman al descuento.
    if (!l.producto.es_kit) {
      p.aDescontar += l.cantidad
      p.stockResultante = p.stockActual - p.aDescontar
      conciliables.push(l)
    }
    productos.set(l.producto.id, p)
  }

  return {
    productos: [...productos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    conciliables,
    sinVincular: [...sinVincular.values()],
  }
}

export interface ResultadoAplicar {
  aplicadas: number
  yaConciliadas: number
  errores: { itemId: number; motivo: string }[]
  pedidosConciliados: number
}

/** Concilia las líneas una por una. Cada una es atómica en el RPC. */
export async function aplicar(
  supabase: SupabaseClient,
  lineas: LineaPendiente[]
): Promise<ResultadoAplicar> {
  const resultado: ResultadoAplicar = { aplicadas: 0, yaConciliadas: 0, errores: [], pedidosConciliados: 0 }

  for (const l of lineas) {
    if (!l.producto) continue

    const { data, error } = await supabase.rpc('conciliar_item_ml', {
      p_item_id: l.itemId,
      p_producto_id: l.producto.id,
    })

    if (error) {
      resultado.errores.push({ itemId: l.itemId, motivo: error.message })
      continue
    }

    const r = data as { ok: boolean; motivo?: string; pedido_conciliado?: boolean } | null
    if (r?.ok) {
      resultado.aplicadas++
      if (r.pedido_conciliado) resultado.pedidosConciliados++
    } else if (r?.motivo === 'ya_conciliado') {
      resultado.yaConciliadas++
    } else {
      resultado.errores.push({ itemId: l.itemId, motivo: r?.motivo ?? 'respuesta vacía del RPC' })
    }
  }

  if (resultado.aplicadas > 0 || resultado.errores.length > 0) {
    await enviarAlerta({
      nivel: resultado.errores.length ? 'atencion' : 'info',
      titulo: 'Conciliación de stock de ventas de ML',
      detalle:
        `Se descontó el stock de ${resultado.aplicadas} línea(s) de ventas viejas ` +
        `(${resultado.pedidosConciliados} pedido(s) quedaron conciliados).` +
        (resultado.errores.length ? ` ${resultado.errores.length} línea(s) fallaron.` : ''),
      contexto: { errores: resultado.errores },
    })
  }

  return resultado
}

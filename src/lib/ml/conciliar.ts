// src/lib/ml/conciliar.ts
//
// Conciliación de stock de ventas de ML que entraron sin descontarlo.
//
// Dos casos:
//   · sin_vincular: la publicación no estaba vinculada a un producto, así que
//     la línea entró con producto_id = null.
//   · stock_insuficiente: descontar_stock_pedido es todo o nada; si a una
//     línea le faltaba stock no descontó ninguna. Se reconoce porque el pedido
//     no tiene su movimiento 'venta'.
//
// Acá se buscan, se simula cuánto baja cada stock (kits → sus componentes) y,
// confirmado, se descuenta línea por línea con el RPC conciliar_item_ml, que
// es idempotente: nunca descuenta dos veces la misma línea.
//
// Si no alcanza el stock se descuenta igual y queda negativo: la venta ya
// ocurrió en ML (decisión de negocio).

import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchOrden } from './client'
import { enviarAlerta } from './alertas'

export interface ComponenteKit {
  id: number
  nombre: string
  stock: number
  /** Unidades del componente por unidad de kit. */
  cantidad: number
}

export interface ProductoConciliable {
  id: number
  nombre: string
  stock: number
  es_kit: boolean
  /** Solo en kits: lo que realmente se descuenta. */
  componentes?: ComponenteKit[]
}

export type MotivoPendiente = 'sin_vincular' | 'stock_insuficiente'

export interface LineaPendiente {
  itemId: number
  pedidoId: number
  mlOrderId: string
  fecha: string
  /** null si no se pudo saber de qué publicación vino. */
  mlItemId: string | null
  titulo: string
  cantidad: number
  motivo: MotivoPendiente
  /** Producto a descontar, o null si la publicación todavía no se vinculó. */
  producto: ProductoConciliable | null
}

interface FilaItem {
  id: number
  pedido_id: number
  producto_id: number | null
  ml_item_id: string | null
  nombre_producto: string
  cantidad: number
  pedidos: { ml_order_id: string | null; fecha_pedido: string }
}

const SELECT_ITEM =
  'id, pedido_id, producto_id, ml_item_id, nombre_producto, cantidad, ' +
  'pedidos!inner(ml_order_id, fecha_pedido, estado, canal_venta)'

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

/** Líneas con producto de pedidos cuyo descuento de stock nunca se hizo. */
async function lineasSinDescuento(
  supabase: SupabaseClient,
  mlItemId?: string
): Promise<FilaItem[]> {
  let consulta = supabase
    .from('items_pedido')
    .select(SELECT_ITEM)
    .not('producto_id', 'is', null)
    .is('stock_conciliado_at', null)
    .eq('pedidos.canal_venta', 'mercadolibre')
    .neq('pedidos.estado', 'cancelado')

  if (mlItemId) consulta = consulta.eq('ml_item_id', mlItemId)

  const { data, error } = await consulta
  if (error) throw new Error(`Error buscando ventas sin descontar: ${error.message}`)

  const filas = (data ?? []) as unknown as FilaItem[]
  const idsPedidos = [...new Set(filas.map(f => f.pedido_id))]
  if (!idsPedidos.length) return []

  // descontar_stock_pedido inserta el movimiento 'venta' solo si descontó.
  const { data: movs, error: errMov } = await supabase
    .from('movimientos')
    .select('referencia_id')
    .eq('tipo', 'venta')
    .eq('referencia_tipo', 'pedido')
    .in('referencia_id', idsPedidos)

  if (errMov) throw new Error(`Error buscando movimientos: ${errMov.message}`)

  const descontados = new Set((movs ?? []).map(m => Number(m.referencia_id)))
  return filas.filter(f => !descontados.has(f.pedido_id))
}

/** Productos por id, con los componentes de los kits. */
async function cargarProductos(
  supabase: SupabaseClient,
  ids: number[]
): Promise<Map<number, ProductoConciliable>> {
  const mapa = new Map<number, ProductoConciliable>()
  if (!ids.length) return mapa

  const { data: productos, error } = await supabase
    .from('productos')
    .select('id, nombre, stock, es_kit')
    .in('id', ids)
  if (error) throw new Error(`Error buscando productos: ${error.message}`)

  for (const p of (productos ?? []) as ProductoConciliable[]) mapa.set(p.id, { ...p })

  const kits = [...mapa.values()].filter(p => p.es_kit).map(p => p.id)
  if (!kits.length) return mapa

  const { data: comps, error: errComp } = await supabase
    .from('componentes_kit')
    .select('kit_id, producto_id, cantidad')
    .in('kit_id', kits)
  if (errComp) throw new Error(`Error buscando componentes de kits: ${errComp.message}`)

  const filasComp = (comps ?? []) as { kit_id: number; producto_id: number; cantidad: number }[]
  const idsComp = [...new Set(filasComp.map(c => c.producto_id))]

  const { data: prodComp, error: errProdComp } = await supabase
    .from('productos')
    .select('id, nombre, stock')
    .in('id', idsComp.length ? idsComp : [-1])
  if (errProdComp) throw new Error(`Error buscando componentes: ${errProdComp.message}`)

  const infoComp = new Map((prodComp ?? []).map(p => [p.id as number, p as { id: number; nombre: string; stock: number }]))

  for (const c of filasComp) {
    const kit = mapa.get(c.kit_id)
    const info = infoComp.get(c.producto_id)
    if (!kit || !info) continue
    kit.componentes = [...(kit.componentes ?? []), { ...info, cantidad: c.cantidad }]
  }

  return mapa
}

/**
 * Líneas de ventas ML no canceladas que todavía no descontaron stock, con el
 * producto a descontar (el vinculado a su publicación, o el que ya tenían).
 */
export async function buscarPendientes(
  supabase: SupabaseClient,
  opciones: { mlItemId?: string; sellerId?: string } = {}
): Promise<LineaPendiente[]> {
  let consulta = supabase
    .from('items_pedido')
    .select(SELECT_ITEM)
    .is('producto_id', null)
    .eq('pedidos.canal_venta', 'mercadolibre')
    .neq('pedidos.estado', 'cancelado')

  if (opciones.mlItemId) consulta = consulta.eq('ml_item_id', opciones.mlItemId)

  const { data, error } = await consulta
  if (error) throw new Error(`Error buscando ventas pendientes: ${error.message}`)

  const sinProducto = (data ?? []) as unknown as FilaItem[]
  if (!opciones.mlItemId) await completarOrigen(supabase, sinProducto, opciones.sellerId)

  const sinDescuento = await lineasSinDescuento(supabase, opciones.mlItemId)

  // Publicación → producto, para las líneas sin producto.
  const idsPublicaciones = [...new Set(sinProducto.map(f => f.ml_item_id).filter((x): x is string => Boolean(x)))]
  const vinculoDe = new Map<string, number>()

  if (idsPublicaciones.length) {
    const { data: vinculos, error: errV } = await supabase
      .from('ml_publicaciones')
      .select('ml_item_id, producto_id')
      .in('ml_item_id', idsPublicaciones)

    if (errV) throw new Error(`Error buscando vínculos: ${errV.message}`)
    for (const v of vinculos ?? []) vinculoDe.set(v.ml_item_id, v.producto_id)
  }

  const idsProductos = [
    ...vinculoDe.values(),
    ...sinDescuento.map(f => f.producto_id!),
  ]
  const productos = await cargarProductos(supabase, [...new Set(idsProductos)])

  const aLinea = (f: FilaItem, motivo: MotivoPendiente, productoId: number | undefined): LineaPendiente => ({
    itemId: f.id,
    pedidoId: f.pedido_id,
    mlOrderId: f.pedidos.ml_order_id ?? '',
    fecha: f.pedidos.fecha_pedido,
    mlItemId: f.ml_item_id,
    titulo: f.nombre_producto,
    cantidad: f.cantidad,
    motivo,
    producto: productoId != null ? productos.get(productoId) ?? null : null,
  })

  return [
    ...sinProducto.map(f => aLinea(f, 'sin_vincular', f.ml_item_id ? vinculoDe.get(f.ml_item_id) : undefined)),
    ...sinDescuento.map(f => aLinea(f, 'stock_insuficiente', f.producto_id!)),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export interface ImpactoProducto {
  productoId: number
  nombre: string
  stockActual: number
  aDescontar: number
  stockResultante: number
  /** Nombres de los kits vendidos que descuentan de este producto. */
  viaKits: string[]
}

export interface Simulacion {
  /** Lo que se va a descontar, agrupado por producto que efectivamente baja. */
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

  const descontar = (p: { id: number; nombre: string; stock: number }, unidades: number, kit?: string) => {
    const imp = productos.get(p.id) ?? {
      productoId: p.id,
      nombre: p.nombre,
      stockActual: p.stock,
      aDescontar: 0,
      stockResultante: p.stock,
      viaKits: [],
    }
    imp.aDescontar += unidades
    imp.stockResultante = imp.stockActual - imp.aDescontar
    if (kit && !imp.viaKits.includes(kit)) imp.viaKits.push(kit)
    productos.set(p.id, imp)
  }

  for (const l of pendientes) {
    if (!l.producto) {
      const clave = l.mlItemId ?? `?${l.titulo}`
      const g = sinVincular.get(clave) ?? { mlItemId: l.mlItemId, titulo: l.titulo, lineas: 0, unidades: 0 }
      g.lineas++
      g.unidades += l.cantidad
      sinVincular.set(clave, g)
      continue
    }

    conciliables.push(l)
    if (l.producto.es_kit) {
      // Igual que descontar_stock_pedido: el kit no tiene stock propio.
      for (const c of l.producto.componentes ?? []) descontar(c, c.cantidad * l.cantidad, l.producto.nombre)
    } else {
      descontar(l.producto, l.cantidad)
    }
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
      if (r.pedido_conciliado && l.motivo === 'sin_vincular') resultado.pedidosConciliados++
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

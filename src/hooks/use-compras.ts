'use client'

// src/hooks/use-compras.ts

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface LineaCompra {
  id?: number
  compra_id?: number
  tipo_destino: 'insumo' | 'producto' | 'otro'
  item_id: number | null
  nombre: string
  categoria_otro?: 'herramienta' | 'packaging' | 'material_trabajo' | 'servicio' | 'otro' | null
  cantidad_pedida: number
  cantidad_recibida: number
  precio_unitario: number
  subtotal?: number
}

export interface PagoCompra {
  id?: number
  compra_id?: number
  fecha: string
  monto: number
  metodo_pago: 'efectivo' | 'transferencia' | 'credito'
  notas?: string
}

export interface Compra {
  id: number
  numero_oc: string | null
  proveedor_id: number | null
  proveedor_nombre: string | null
  fecha: string
  tipo: 'pedido' | 'directa'
  estado: 'borrador' | 'pendiente' | 'recibida' | 'recibida_parcial' | 'cancelada'
  metodo_pago: 'efectivo' | 'transferencia' | 'credito' | null
  estado_pago: 'pagado' | 'pendiente' | 'parcial'
  monto_total: number
  monto_pagado: number
  numero_remito: string | null
  numero_factura: string | null
  notas: string | null
  created_at: string
  total_lineas: number
  cant_lineas: number
  total_pagado_real: number
}

export interface FiltrosCompras {
  busqueda: string
  estado: string
  estado_pago: string
  desde: string
  hasta: string
}

const FILTROS_INICIALES: FiltrosCompras = {
  busqueda: '',
  estado: '',
  estado_pago: '',
  desde: '',
  hasta: '',
}

export function useCompras(soloTipo?: 'directa' | 'pedido') {
  const [todas, setTodas] = useState<Compra[]>([])
  const [filtros, setFiltrosState] = useState<FiltrosCompras>(FILTROS_INICIALES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCompras = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    let query = supabase
      .from('compras_con_total')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    if (soloTipo) query = query.eq('tipo', soloTipo)

    const { data, error: err } = await query
    if (err) setError('Error al cargar compras')
    else setTodas(data ?? [])
    setLoading(false)
  }, [soloTipo])

  useEffect(() => { fetchCompras() }, [fetchCompras])

  const setFiltros = useCallback((f: Partial<FiltrosCompras>) => {
    setFiltrosState(prev => ({ ...prev, ...f }))
  }, [])

  const limpiarFiltros = useCallback(() => setFiltrosState(FILTROS_INICIALES), [])

  const compras = todas.filter(c => {
    if (filtros.busqueda) {
      const q = filtros.busqueda.toLowerCase()
      if (
        !c.proveedor_nombre?.toLowerCase().includes(q) &&
        !String(c.id).includes(q) &&
        !c.numero_oc?.toLowerCase().includes(q) &&
        !c.numero_factura?.toLowerCase().includes(q) &&
        !c.numero_remito?.toLowerCase().includes(q)
      ) return false
    }
    if (filtros.estado && c.estado !== filtros.estado) return false
    if (filtros.estado_pago && c.estado_pago !== filtros.estado_pago) return false
    if (filtros.desde && c.fecha < filtros.desde) return false
    if (filtros.hasta && c.fecha > filtros.hasta) return false
    return true
  })

  const stats = {
    total: todas.length,
    pendientes: todas.filter(c => c.estado === 'pendiente').length,
    sinPagar: todas.filter(c => c.estado_pago === 'pendiente').length,
    montoMes: todas
      .filter(c => {
        const inicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        return new Date(c.fecha) >= inicio
      })
      .reduce((s, c) => s + c.total_lineas, 0),
  }

  // ── Guardar compra/pedido completo ────────────────────────
  const guardarCompra = useCallback(async (
    datos: Partial<Compra>,
    lineas: LineaCompra[],
    pagos: PagoCompra[],
    id?: number
  ): Promise<number | false> => {
    const supabase = createClient()
    try {
      let compraId = id

      if (id) {
        const { error: errUpdate } = await supabase
          .from('compras')
          .update({
            proveedor_id: datos.proveedor_id ?? null,
            fecha: datos.fecha,
            estado: datos.estado,
            metodo_pago: datos.metodo_pago ?? null,
            estado_pago: datos.estado_pago,
            numero_remito: datos.numero_remito ?? null,
            numero_factura: datos.numero_factura ?? null,
            notas: datos.notas ?? null,
          })
          .eq('id', id)
        if (errUpdate) throw errUpdate

        await supabase.from('lineas_compra').delete().eq('compra_id', id)
        await supabase.from('pagos_compra').delete().eq('compra_id', id)
      } else {
        const { data: nueva, error: errInsert } = await supabase
          .from('compras')
          .insert({
            proveedor_id: datos.proveedor_id ?? null,
            fecha: datos.fecha ?? new Date().toISOString().split('T')[0],
            tipo: datos.tipo ?? 'directa',
            estado: datos.estado ?? 'recibida',
            metodo_pago: datos.metodo_pago ?? null,
            estado_pago: datos.estado_pago ?? 'pagado',
            numero_remito: datos.numero_remito ?? null,
            numero_factura: datos.numero_factura ?? null,
            notas: datos.notas ?? null,
          })
          .select('id')
          .single()
        if (errInsert || !nueva) throw errInsert
        compraId = nueva.id
      }

      if (!compraId) throw new Error('No se obtuvo ID')

      if (lineas.length > 0) {
        const { error: errLineas } = await supabase.from('lineas_compra').insert(
          lineas.map(l => ({
            compra_id: compraId,
            tipo_destino: l.tipo_destino,
            item_id: l.item_id ?? null,
            nombre: l.nombre,
            categoria_otro: l.categoria_otro ?? null,
            cantidad_pedida: l.cantidad_pedida,
            cantidad_recibida: l.cantidad_recibida,
            precio_unitario: l.precio_unitario,
          }))
        )
        if (errLineas) throw errLineas
      }

      if (pagos.length > 0) {
        const { error: errPagos } = await supabase.from('pagos_compra').insert(
          pagos.map(p => ({
            compra_id: compraId,
            fecha: p.fecha,
            monto: p.monto,
            metodo_pago: p.metodo_pago,
            notas: p.notas ?? null,
          }))
        )
        if (errPagos) throw errPagos
      }

      if (datos.estado === 'recibida' || datos.estado === 'recibida_parcial') {
        await impactarStock(supabase, compraId!, lineas)
      }

      await fetchCompras()
      return compraId!
    } catch (e) {
      console.error('Error guardando compra:', e)
      return false
    }
  }, [fetchCompras])

  const eliminarCompra = useCallback(async (id: number): Promise<boolean> => {
    const supabase = createClient()
    const { error: err } = await supabase.from('compras').delete().eq('id', id)
    if (err) return false
    await fetchCompras()
    return true
  }, [fetchCompras])

  const recibirCompra = useCallback(async (
    id: number,
    lineasActualizadas: LineaCompra[],
    parcial: boolean,
    datosRecepcion: { numero_remito?: string; numero_factura?: string }
  ): Promise<boolean> => {
    const supabase = createClient()
    try {
      const nuevoEstado = parcial ? 'recibida_parcial' : 'recibida'

      await supabase.from('compras').update({
        estado: nuevoEstado,
        numero_remito: datosRecepcion.numero_remito ?? null,
        numero_factura: datosRecepcion.numero_factura ?? null,
      }).eq('id', id)

      for (const l of lineasActualizadas) {
        if (l.id) {
          await supabase.from('lineas_compra')
            .update({ cantidad_recibida: l.cantidad_recibida })
            .eq('id', l.id)
        }
      }

      await impactarStock(supabase, id, lineasActualizadas)
      await fetchCompras()
      return true
    } catch {
      return false
    }
  }, [fetchCompras])

  const registrarPago = useCallback(async (
    compraId: number,
    pago: PagoCompra,
    totalLineas: number,
    totalPagadoActual: number
  ): Promise<boolean> => {
    const supabase = createClient()
    try {
      await supabase.from('pagos_compra').insert({
        compra_id: compraId,
        fecha: pago.fecha,
        monto: pago.monto,
        metodo_pago: pago.metodo_pago,
        notas: pago.notas ?? null,
      })
      const nuevoPagado = totalPagadoActual + pago.monto
      const nuevoEstado = nuevoPagado >= totalLineas ? 'pagado' : 'parcial'
      await supabase.from('compras')
        .update({ estado_pago: nuevoEstado, monto_pagado: nuevoPagado })
        .eq('id', compraId)
      await fetchCompras()
      return true
    } catch {
      return false
    }
  }, [fetchCompras])

  return {
    compras, todas, stats, loading, error,
    filtros, setFiltros, limpiarFiltros,
    recargar: fetchCompras,
    guardarCompra, eliminarCompra, recibirCompra, registrarPago,
  }
}

// ── Impactar stock ────────────────────────────────────────────
async function impactarStock(supabase: any, compraId: number, lineas: LineaCompra[]) {
  // Si las líneas no tienen cantidad_recibida actualizada, las traemos de la DB
  const lineasAUsar = lineas.length > 0 && lineas[0].id
    ? lineas
    : await supabase.from('lineas_compra').select('*').eq('compra_id', compraId).then((r: any) => r.data ?? [])

  for (const l of lineasAUsar) {
    const cantidad = l.cantidad_recibida
    if (cantidad <= 0) continue

    if (l.tipo_destino === 'insumo' && l.item_id) {
      const { data: ins } = await supabase.from('insumos').select('stock, costo').eq('id', l.item_id).single()
      if (ins) {
        await supabase.from('insumos').update({
          stock: ins.stock + cantidad,
          costo: l.precio_unitario > 0 ? l.precio_unitario : ins.costo,
        }).eq('id', l.item_id)
      }
    } else if (l.tipo_destino === 'producto' && l.item_id) {
      const { data: prod } = await supabase.from('productos').select('stock, costo').eq('id', l.item_id).single()
      if (prod) {
        await supabase.from('productos').update({
          stock: prod.stock + cantidad,
          costo: l.precio_unitario > 0 ? l.precio_unitario : prod.costo,
        }).eq('id', l.item_id)
      }
    }
  }
}
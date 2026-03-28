'use client'

// src/hooks/use-ventas.ts
// Versión con realtime.

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'
import type { PedidoConTotal, EstadoPedido, MetodoPago, CanalVenta } from '@/lib/types'

export interface FiltrosVentas {
  busqueda: string
  estado: EstadoPedido | ''
  metodo_pago: MetodoPago | ''
  canal_venta: CanalVenta | ''
  desde: string
  hasta: string
}

const FILTROS_INICIALES: FiltrosVentas = {
  busqueda: '',
  estado: '',
  metodo_pago: '',
  canal_venta: '',
  desde: '',
  hasta: '',
}

interface ResumenMetodos {
  efectivo: number
  transferencia: number
  debito: number
  credito: number
}

interface UseVentasReturn {
  ventas: PedidoConTotal[]
  resumenMetodos: ResumenMetodos
  totalPeriodo: number
  totalCobrado: number
  totalPendiente: number
  loading: boolean
  error: string | null
  filtros: FiltrosVentas
  ultimaActualizacion: Date | null
  setFiltros: (f: Partial<FiltrosVentas>) => void
  limpiarFiltros: () => void
}

export function useVentas(): UseVentasReturn {
  const [ventas, setVentas] = useState<PedidoConTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtros, setFiltrosState] = useState<FiltrosVentas>(FILTROS_INICIALES)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null)

  const setFiltros = useCallback((f: Partial<FiltrosVentas>) => {
    setFiltrosState(prev => ({ ...prev, ...f }))
  }, [])

  const limpiarFiltros = useCallback(() => {
    setFiltrosState(FILTROS_INICIALES)
  }, [])

  const fetchVentas = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('pedidos_con_total')
        .select('*')
        .order('fecha_pedido', { ascending: false })

      if (filtros.estado) {
        query = query.eq('estado', filtros.estado)
      } else {
        query = query.neq('estado', 'presupuesto')
      }
      if (filtros.metodo_pago)  query = query.eq('metodo_pago', filtros.metodo_pago)
      if (filtros.canal_venta)  query = query.eq('canal_venta', filtros.canal_venta)
      if (filtros.desde)        query = query.gte('fecha_confirmacion', filtros.desde)
      if (filtros.hasta)        query = query.lte('fecha_confirmacion', filtros.hasta + 'T23:59:59')
      if (filtros.busqueda)     query = query.ilike('cliente_nombre', `%${filtros.busqueda}%`)

      const { data, error: err } = await query.limit(50)
      if (err) throw err

      setVentas(data ?? [])
      setUltimaActualizacion(new Date())
    } catch {
      setError('Error al cargar las ventas')
    } finally {
      setLoading(false)
    }
  }, [filtros])

  // Carga inicial y cuando cambian los filtros
  useEffect(() => {
    fetchVentas()
  }, [fetchVentas])

  // Realtime — recarga cuando n8n u otro cliente modifica pedidos
  useRealtime({
    tablas: ['pedidos', 'items_pedido', 'pagos_pedido'],
    onCambio: fetchVentas,
  })

  const resumenMetodos: ResumenMetodos = {
    efectivo:      ventas.filter(v => v.metodo_pago === 'efectivo').reduce((s, v) => s + v.total_cobrado, 0),
    transferencia: ventas.filter(v => v.metodo_pago === 'transferencia').reduce((s, v) => s + v.total_cobrado, 0),
    debito:        ventas.filter(v => v.metodo_pago === 'debito').reduce((s, v) => s + v.total_cobrado, 0),
    credito:       ventas.filter(v => v.metodo_pago === 'credito').reduce((s, v) => s + v.total_cobrado, 0),
  }

  return {
    ventas,
    resumenMetodos,
    totalPeriodo:   ventas.reduce((s, v) => s + v.total_cobrado, 0),
    totalCobrado:   ventas.reduce((s, v) => s + v.cobrado, 0),
    totalPendiente: ventas.reduce((s, v) => s + v.pendiente, 0),
    loading,
    error,
    filtros,
    ultimaActualizacion,
    setFiltros,
    limpiarFiltros,
    fetchVentas,
    recargar
  }
}
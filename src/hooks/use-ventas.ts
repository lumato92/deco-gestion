'use client'

// src/hooks/use-ventas.ts

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
  recargar: () => void
}

export function useVentas(): UseVentasReturn {
  const [ventas, setVentas] = useState<PedidoConTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtros, setFiltrosState] = useState<FiltrosVentas>(FILTROS_INICIALES)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null)
  const [tick, setTick] = useState(0)

  const setFiltros = useCallback((f: Partial<FiltrosVentas>) => {
    setFiltrosState(prev => ({ ...prev, ...f }))
  }, [])

  const limpiarFiltros = useCallback(() => {
    setFiltrosState(FILTROS_INICIALES)
  }, [])

  const recargar = useCallback(() => {
    setTick(t => t + 1)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    async function fetchVentas() {
      setLoading(true)
      setError(null)

      try {
        let query = supabase
          .from('pedidos_con_total')
          .select('*')
          .order('fecha_pedido', { ascending: false })

        if (filtros.estado) {
          // Si el usuario eligió un estado específico (incluyendo cancelado), mostrarlo
          query = query.eq('estado', filtros.estado)
        } else {
          // Sin filtro: excluir presupuestos Y canceladas de la vista principal
          // Las canceladas se pueden ver eligiendo el tab "Canceladas"
          query = query.not('estado', 'in', '("presupuesto","cancelado")')
        }

        if (filtros.metodo_pago) query = query.eq('metodo_pago', filtros.metodo_pago)
        if (filtros.canal_venta) query = query.eq('canal_venta', filtros.canal_venta)
        if (filtros.desde)       query = query.gte('fecha_confirmacion', filtros.desde)
        if (filtros.hasta)       query = query.lte('fecha_confirmacion', filtros.hasta + 'T23:59:59')
        if (filtros.busqueda)    query = query.ilike('cliente_nombre', `%${filtros.busqueda}%`)

        const { data, error: err } = await query.limit(100)

        if (err) throw err
        setVentas(data ?? [])
        setUltimaActualizacion(new Date())
      } catch {
        setError('Error al cargar las ventas')
      } finally {
        setLoading(false)
      }
    }

    fetchVentas()
  }, [filtros, tick])

  useRealtime({
    tablas: ['pedidos', 'items_pedido', 'pagos_pedido'],
    onCambio: recargar,
  })

  // Resumen por método — solo ventas activas (no canceladas)
  const ventasActivas = ventas.filter(v => v.estado !== 'cancelado')

  const resumenMetodos: ResumenMetodos = {
    efectivo:      ventasActivas.filter(v => v.metodo_pago === 'efectivo').reduce((s, v) => s + v.total_cobrado, 0),
    transferencia: ventasActivas.filter(v => v.metodo_pago === 'transferencia').reduce((s, v) => s + v.total_cobrado, 0),
    debito:        ventasActivas.filter(v => v.metodo_pago === 'debito').reduce((s, v) => s + v.total_cobrado, 0),
    credito:       ventasActivas.filter(v => v.metodo_pago === 'credito').reduce((s, v) => s + v.total_cobrado, 0),
  }

  return {
    ventas,
    resumenMetodos,
    // Totales calculados solo sobre ventas activas
    totalPeriodo:   ventasActivas.reduce((s, v) => s + v.total_cobrado, 0),
    totalCobrado:   ventasActivas.reduce((s, v) => s + v.cobrado, 0),
    totalPendiente: ventasActivas.reduce((s, v) => s + v.pendiente, 0),
    loading,
    error,
    filtros,
    ultimaActualizacion,
    setFiltros,
    limpiarFiltros,
    recargar,
  }
}
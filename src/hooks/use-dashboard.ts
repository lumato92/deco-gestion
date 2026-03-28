'use client'

// src/hooks/use-dashboard.ts
// Versión con realtime — se actualiza automáticamente cuando
// n8n u otro cliente modifica pedidos, gastos o insumos.

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'
import type {
  ResumenFinancieroMes,
  PedidoConTotal,
  TopProductoMes,
} from '@/lib/types'

interface AlertaStock {
  id: number
  nombre: string
  stock: number
  minimo: number
  unidad: string
  estado_stock: 'bajo' | 'medio'
}

interface FabricacionPendiente {
  id: number
  cliente_nombre: string
  cliente_telefono: string
  notas: string
  fecha_compromiso_fabricacion: string
  dias_restantes: number
  estado_plazo: 'llegó' | 'retrasado' | 'vence hoy' | 'en plazo'
}

interface DashboardData {
  resumen: ResumenFinancieroMes | null
  ventasRecientes: PedidoConTotal[]
  topProductos: TopProductoMes[]
  alertasStock: AlertaStock[]
  fabricacionPendiente: FabricacionPendiente[]
  loading: boolean
  error: string | null
  ultimaActualizacion: Date | null
}

// Tablas que afectan al dashboard
const TABLAS_DASHBOARD = [
  'pedidos',
  'items_pedido',
  'pagos_pedido',
  'gastos',
  'insumos',
]

export function useDashboard(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    resumen: null,
    ventasRecientes: [],
    topProductos: [],
    alertasStock: [],
    fabricacionPendiente: [],
    loading: true,
    error: null,
    ultimaActualizacion: null,
  })

  const fetchAll = useCallback(async () => {
    const supabase = createClient()

    try {
      const [
        resumenRes,
        ventasRes,
        topProdRes,
        stockRes,
        fabricRes,
      ] = await Promise.all([
        supabase.from('resumen_financiero_mes').select('*').single(),
        supabase
          .from('pedidos_con_total')
          .select('*')
          .not('estado', 'eq', 'cancelado')
          .order('fecha_pedido', { ascending: false })
          .limit(8),
        supabase.from('top_productos_mes').select('*').limit(5),
        supabase
          .from('insumos_con_estado')
          .select('id, nombre, stock, minimo, unidad, estado_stock')
          .in('estado_stock', ['bajo', 'medio'])
          .order('estado_stock', { ascending: true })
          .limit(5),
        supabase
          .from('pedidos_en_fabricacion')
          .select('*')
          .order('dias_restantes', { ascending: true })
          .limit(5),
      ])

      setData({
        resumen: resumenRes.data,
        ventasRecientes: ventasRes.data ?? [],
        topProductos: topProdRes.data ?? [],
        alertasStock: (stockRes.data ?? []) as AlertaStock[],
        fabricacionPendiente: (fabricRes.data ?? []) as FabricacionPendiente[],
        loading: false,
        error: null,
        ultimaActualizacion: new Date(),
      })
    } catch {
      setData(prev => ({
        ...prev,
        loading: false,
        error: 'Error al cargar los datos del dashboard',
      }))
    }
  }, [])

  // Carga inicial
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Realtime — recarga cuando cambia cualquier tabla relevante
  useRealtime({
    tablas: TABLAS_DASHBOARD,
    onCambio: fetchAll,
  })

  return data
}
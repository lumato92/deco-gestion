'use client'
// src/hooks/use-dashboard.ts

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'
import type { ResumenFinancieroMes, PedidoConTotal, TopProductoMes } from '@/lib/types'

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

interface PagoPointPendiente {
  id: number
  mp_pago_id: string
  monto: number
  monto_neto: number
  comisiones: number
  medio: string | null
  cuotas: number
  fecha_pago: string
}

interface BalanceMP {
  available_balance: number
  unavailable_balance: number
  total_amount: number
}

interface DashboardData {
  resumen: ResumenFinancieroMes | null
  ventasRecientes: PedidoConTotal[]
  topProductos: TopProductoMes[]
  alertasStock: AlertaStock[]
  fabricacionPendiente: FabricacionPendiente[]
  pagosPointPendientes: PagoPointPendiente[]
  balanceMP: BalanceMP | null
  presupuestosSinConfirmar: PedidoConTotal[]
  loading: boolean
  error: string | null
  ultimaActualizacion: Date | null
}

const TABLAS_DASHBOARD = [
  'pedidos', 'items_pedido', 'pagos_pedido',
  'gastos', 'insumos', 'pagos_point_pendientes',
]

export function useDashboard(): DashboardData & { recargar: () => void } {
  const [data, setData] = useState<DashboardData>({
    resumen: null,
    ventasRecientes: [],
    topProductos: [],
    alertasStock: [],
    fabricacionPendiente: [],
    pagosPointPendientes: [],
    balanceMP: null,
    presupuestosSinConfirmar: [],
    loading: true,
    error: null,
    ultimaActualizacion: null,
  })

  const fetchAll = useCallback(async () => {
    const supabase = createClient()
    try {
      const [
        resumenRes, ventasRes, topProdRes,
        stockRes, fabricRes, pointRes, presupuestosRes,
      ] = await Promise.all([
        supabase.from('resumen_financiero_mes').select('*').single(),
        supabase
          .from('pedidos_con_total')
          .select('*')
          .not('estado', 'eq', 'cancelado')
          .not('estado', 'eq', 'presupuesto')
          .order('fecha_pedido', { ascending: false })
          .limit(5),
        supabase.from('top_productos_mes').select('*').limit(5),
        supabase
          .from('insumos_con_estado')
          .select('id, nombre, stock, minimo, unidad, estado_stock')
          .in('estado_stock', ['bajo', 'medio'])
          .order('estado_stock', { ascending: true })
          .limit(6),
        supabase
          .from('pedidos_en_fabricacion')
          .select('*')
          .order('dias_restantes', { ascending: true })
          .limit(5),
        supabase
          .from('pagos_point_pendientes')
          .select('id, mp_pago_id, monto, monto_neto, comisiones, medio, cuotas, fecha_pago')
          .eq('estado', 'pendiente')
          .order('fecha_pago', { ascending: false }),
        supabase
          .from('pedidos_con_total')
          .select('*')
          .eq('estado', 'presupuesto')
          .order('fecha_pedido', { ascending: true })
          .limit(5),
      ])

      // Balance MP — llamada directa a la API
      let balanceMP: BalanceMP | null = null
      try {
        const balanceRes = await fetch('/api/mp/balance')
        if (balanceRes.ok) balanceMP = await balanceRes.json()
      } catch {}

      setData({
        resumen: resumenRes.data,
        ventasRecientes: ventasRes.data ?? [],
        topProductos: topProdRes.data ?? [],
        alertasStock: (stockRes.data ?? []) as AlertaStock[],
        fabricacionPendiente: (fabricRes.data ?? []) as FabricacionPendiente[],
        pagosPointPendientes: (pointRes.data ?? []) as PagoPointPendiente[],
        balanceMP,
        presupuestosSinConfirmar: presupuestosRes.data ?? [],
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

  useEffect(() => { fetchAll() }, [fetchAll])

  useRealtime({ tablas: TABLAS_DASHBOARD, onCambio: fetchAll })

  return { ...data, recargar: fetchAll }
}
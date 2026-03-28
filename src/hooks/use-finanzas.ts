'use client'

// src/hooks/use-finanzas.ts

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'

export interface ResumenMes {
  mes: string           // '2025-01', '2025-02', etc.
  mes_label: string     // 'Ene', 'Feb', etc.
  ingresos: number
  ganancia_bruta: number
  total_gastos: number
  resultado_neto: number
  cant_pedidos: number
}

export interface DesglosePago {
  metodo: string
  total: number
  cant: number
  pct: number
}

export interface DesgloseCategoriaGasto {
  categoria: string
  total: number
  pct: number
}

export interface TopCliente {
  cliente_nombre: string
  total_compras: number
  cant_pedidos: number
}

export interface FinanzasData {
  mesActual: {
    ingresos: number
    ganancia_bruta: number
    total_gastos: number
    resultado_neto: number
    cant_pedidos: number
    margen_pct: number
  } | null
  historico: ResumenMes[]
  desglosePagos: DesglosePago[]
  desgloseGastos: DesgloseCategoriaGasto[]
  topClientes: TopCliente[]
  loading: boolean
  error: string | null
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export function useFinanzas() {
  const [data, setData] = useState<FinanzasData>({
    mesActual: null,
    historico: [],
    desglosePagos: [],
    desgloseGastos: [],
    topClientes: [],
    loading: true,
    error: null,
  })

  const fetchAll = useCallback(async () => {
    const supabase = createClient()

    try {
      const hoy = new Date()
      const anio = hoy.getFullYear()

      // Últimos 6 meses para el histórico
      const mesesQuery = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      }).reverse()

      const [mesActualRes, pedidosHistRes, gastosHistRes, desglosePagosRes, topClientesRes] =
        await Promise.all([
          // Resumen mes actual
          supabase.from('resumen_financiero_mes').select('*').single(),

          // Pedidos de los últimos 6 meses
          supabase
            .from('pedidos_con_total')
            .select('fecha_confirmacion, total_cobrado, ganancia, cant_items')
            .eq('estado', 'entregado')
            .gte('fecha_confirmacion', `${mesesQuery[0]}-01`)
            .order('fecha_confirmacion'),

          // Gastos de los últimos 6 meses
          supabase
            .from('gastos')
            .select('fecha, monto, categoria, metodo_pago')
            .gte('fecha', `${mesesQuery[0]}-01`),

          // Desglose por método de pago (mes actual)
          supabase
            .from('pagos_pedido')
            .select('metodo_pago, monto')
            .gte('created_at', `${mesesQuery[mesesQuery.length - 1]}-01`),

          // Top clientes del mes
          supabase
            .from('pedidos_con_total')
            .select('cliente_nombre, total_cobrado')
            .not('estado', 'eq', 'cancelado')
            .not('estado', 'eq', 'presupuesto')
            .not('cliente_nombre', 'is', null)
            .gte('fecha_confirmacion', `${mesesQuery[mesesQuery.length - 1]}-01`)
            .order('total_cobrado', { ascending: false })
            .limit(5),
        ])

      // Armar histórico por mes
      const pedidos = pedidosHistRes.data ?? []
      const gastos = gastosHistRes.data ?? []

      const historico: ResumenMes[] = mesesQuery.map(mes => {
        const [anioStr, mesStr] = mes.split('-')
        const mesIdx = parseInt(mesStr) - 1
        const label = MESES[mesIdx]

        const pedidosMes = pedidos.filter(p =>
          p.fecha_confirmacion?.startsWith(mes)
        )
        const gastosMes = gastos.filter(g => g.fecha?.startsWith(mes))

        const ingresos = pedidosMes.reduce((s, p) => s + (p.total_cobrado ?? 0), 0)
        const ganancia = pedidosMes.reduce((s, p) => s + (p.ganancia ?? 0), 0)
        const totalGastos = gastosMes.reduce((s, g) => s + (g.monto ?? 0), 0)

        return {
          mes, mes_label: label,
          ingresos, ganancia_bruta: ganancia,
          total_gastos: totalGastos,
          resultado_neto: ganancia - totalGastos,
          cant_pedidos: pedidosMes.length,
        }
      })

      // Desglose por método de pago
      const pagos = desglosePagosRes.data ?? []
      const totalPagos = pagos.reduce((s, p) => s + p.monto, 0)
      const metodosMap: Record<string, { total: number; cant: number }> = {}
      pagos.forEach(p => {
        if (!metodosMap[p.metodo_pago]) metodosMap[p.metodo_pago] = { total: 0, cant: 0 }
        metodosMap[p.metodo_pago].total += p.monto
        metodosMap[p.metodo_pago].cant += 1
      })
      const desglosePagos: DesglosePago[] = Object.entries(metodosMap).map(([metodo, v]) => ({
        metodo, total: v.total, cant: v.cant,
        pct: totalPagos > 0 ? Math.round(v.total / totalPagos * 100) : 0,
      })).sort((a, b) => b.total - a.total)

      // Desglose gastos por categoría (mes actual)
      const mesActualStr = `${anio}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
      const gastosMesActual = gastos.filter(g => g.fecha?.startsWith(mesActualStr))
      const totalGastosMes = gastosMesActual.reduce((s, g) => s + g.monto, 0)
      const catMap: Record<string, number> = {}
      gastosMesActual.forEach(g => {
        catMap[g.categoria] = (catMap[g.categoria] ?? 0) + g.monto
      })
      const desgloseGastos: DesgloseCategoriaGasto[] = Object.entries(catMap)
        .map(([categoria, total]) => ({
          categoria, total,
          pct: totalGastosMes > 0 ? Math.round(total / totalGastosMes * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total)

      // Top clientes
      const clientesMap: Record<string, { total: number; cant: number }> = {}
      ;(topClientesRes.data ?? []).forEach((p: any) => {
        const nombre = p.cliente_nombre
        if (!clientesMap[nombre]) clientesMap[nombre] = { total: 0, cant: 0 }
        clientesMap[nombre].total += p.total_cobrado
        clientesMap[nombre].cant += 1
      })
      const topClientes: TopCliente[] = Object.entries(clientesMap)
        .map(([cliente_nombre, v]) => ({
          cliente_nombre, total_compras: v.total, cant_pedidos: v.cant,
        }))
        .sort((a, b) => b.total_compras - a.total_compras)
        .slice(0, 5)

      const resumen = mesActualRes.data
      const margen = resumen?.ingresos > 0
        ? Math.round(resumen.ganancia_bruta / resumen.ingresos * 100)
        : 0

      setData({
        mesActual: resumen ? { ...resumen, margen_pct: margen } : null,
        historico,
        desglosePagos,
        desgloseGastos,
        topClientes,
        loading: false,
        error: null,
      })
    } catch (e) {
      setData(prev => ({ ...prev, loading: false, error: 'Error al cargar datos financieros' }))
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useRealtime({
    tablas: ['pedidos', 'pagos_pedido', 'gastos'],
    onCambio: fetchAll,
  })

  return data
}
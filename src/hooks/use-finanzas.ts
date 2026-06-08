'use client'

// src/hooks/use-finanzas.ts

import { useEffect, useState, useCallback, useMemo } from 'react'
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

export interface ResumenMesActual {
  ingresos: number
  ganancia_bruta: number
  total_gastos: number
  resultado_neto: number
  cant_pedidos: number
  margen_pct: number
}

export interface MesOpcion {
  value: string   // 'YYYY-MM'
  label: string   // 'Junio 2026'
}

// Estados que cuentan como venta concretada para finanzas.
const ESTADOS_VENTA = ['confirmado', 'reservado', 'en_fabricacion', 'entregado']

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function ymActual() {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
}

function labelLargo(ym: string) {
  const [anio, mes] = ym.split('-')
  return `${MESES_LARGO[parseInt(mes) - 1]} ${anio}`
}

interface PedidoRaw {
  fecha_confirmacion: string | null
  total_cobrado: number | null
  ganancia: number | null
  comisiones_mp: number | null
  cant_items: number | null
  cliente_nombre: string | null
  canal_venta: string | null
  estado: string | null
}
interface GastoRaw { fecha: string | null; monto: number | null; categoria: string; metodo_pago: string }
interface PagoRaw { metodo_pago: string; monto: number | null; created_at: string | null }

interface RawData {
  pedidos: PedidoRaw[]
  gastos: GastoRaw[]
  pagos: PagoRaw[]
}

export function useFinanzas() {
  const [raw, setRaw] = useState<RawData>({ pedidos: [], gastos: [], pagos: [] })
  const [mesSeleccionado, setMesSeleccionado] = useState<string>(ymActual())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    try {
      // Ventana de 12 meses hacia atrás
      const hoy = new Date()
      const inicioVentana = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1)
      const desde = `${inicioVentana.getFullYear()}-${String(inicioVentana.getMonth() + 1).padStart(2, '0')}-01`

      const [pedidosRes, gastosRes, pagosRes] = await Promise.all([
        supabase
          .from('pedidos_con_total')
          .select('fecha_confirmacion, total_cobrado, ganancia, comisiones_mp, cant_items, cliente_nombre, canal_venta, estado')
          .in('estado', ESTADOS_VENTA)
          .gte('fecha_confirmacion', `${desde}`)
          .order('fecha_confirmacion'),
        supabase
          .from('gastos')
          .select('fecha, monto, categoria, metodo_pago')
          .gte('fecha', desde),
        supabase
          .from('pagos_pedido')
          .select('metodo_pago, monto, comisiones, created_at')
          .gte('created_at', desde),
      ])

      if (pedidosRes.error || gastosRes.error || pagosRes.error) {
        throw new Error('Error al cargar datos financieros')
      }

      setRaw({
        pedidos: (pedidosRes.data ?? []) as PedidoRaw[],
        gastos: (gastosRes.data ?? []) as GastoRaw[],
        pagos: (pagosRes.data ?? []) as PagoRaw[],
      })
      setError(null)
    } catch {
      setError('Error al cargar datos financieros')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useRealtime({
    tablas: ['pedidos', 'pagos_pedido', 'gastos'],
    onCambio: fetchAll,
  })

  // ── Meses disponibles para el selector (últimos 12) ──────────
  const mesesDisponibles = useMemo<MesOpcion[]>(() => {
    const hoy = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return { value, label: labelLargo(value) }
    })
  }, [])

  // ── Histórico (últimos 6 meses) para los gráficos ────────────
  const historico = useMemo<ResumenMes[]>(() => {
    const hoy = new Date()
    const meses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }).reverse()

    return meses.map(mes => {
      const mesIdx = parseInt(mes.split('-')[1]) - 1
      const pedidosMes = raw.pedidos.filter(p => p.fecha_confirmacion?.startsWith(mes))
      const gastosMes = raw.gastos.filter(g => g.fecha?.startsWith(mes))

      // Ingreso y ganancia netos de comisiones de MP
      const ingresos = pedidosMes.reduce((s, p) => s + (p.total_cobrado ?? 0) - (p.comisiones_mp ?? 0), 0)
      const ganancia = pedidosMes.reduce((s, p) => s + (p.ganancia ?? 0) - (p.comisiones_mp ?? 0), 0)
      const totalGastos = gastosMes.reduce((s, g) => s + (g.monto ?? 0), 0)

      return {
        mes, mes_label: MESES[mesIdx],
        ingresos, ganancia_bruta: ganancia,
        total_gastos: totalGastos,
        resultado_neto: ganancia - totalGastos,
        cant_pedidos: pedidosMes.length,
      }
    })
  }, [raw])

  // ── Resumen del mes seleccionado ─────────────────────────────
  const mesActual = useMemo<ResumenMesActual>(() => {
    const pedidosMes = raw.pedidos.filter(p => p.fecha_confirmacion?.startsWith(mesSeleccionado))
    const gastosMes = raw.gastos.filter(g => g.fecha?.startsWith(mesSeleccionado))

    const ingresos = pedidosMes.reduce((s, p) => s + (p.total_cobrado ?? 0) - (p.comisiones_mp ?? 0), 0)
    const ganancia = pedidosMes.reduce((s, p) => s + (p.ganancia ?? 0) - (p.comisiones_mp ?? 0), 0)
    const totalGastos = gastosMes.reduce((s, g) => s + (g.monto ?? 0), 0)

    return {
      ingresos,
      ganancia_bruta: ganancia,
      total_gastos: totalGastos,
      resultado_neto: ganancia - totalGastos,
      cant_pedidos: pedidosMes.length,
      margen_pct: ingresos > 0 ? Math.round(ganancia / ingresos * 100) : 0,
    }
  }, [raw, mesSeleccionado])

  // ── Desglose por método de pago (mes seleccionado) ───────────
  const desglosePagos = useMemo<DesglosePago[]>(() => {
    const pagosMes = raw.pagos.filter(p => p.created_at?.startsWith(mesSeleccionado))
    const total = pagosMes.reduce((s, p) => s + (p.monto ?? 0), 0)
    const map: Record<string, { total: number; cant: number }> = {}
    pagosMes.forEach(p => {
      if (!map[p.metodo_pago]) map[p.metodo_pago] = { total: 0, cant: 0 }
      map[p.metodo_pago].total += p.monto ?? 0
      map[p.metodo_pago].cant += 1
    })
    return Object.entries(map).map(([metodo, v]) => ({
      metodo, total: v.total, cant: v.cant,
      pct: total > 0 ? Math.round(v.total / total * 100) : 0,
    })).sort((a, b) => b.total - a.total)
  }, [raw, mesSeleccionado])

  // ── Gastos por categoría (mes seleccionado) ──────────────────
  const desgloseGastos = useMemo<DesgloseCategoriaGasto[]>(() => {
    const gastosMes = raw.gastos.filter(g => g.fecha?.startsWith(mesSeleccionado))
    const total = gastosMes.reduce((s, g) => s + (g.monto ?? 0), 0)
    const map: Record<string, number> = {}
    gastosMes.forEach(g => { map[g.categoria] = (map[g.categoria] ?? 0) + (g.monto ?? 0) })
    return Object.entries(map)
      .map(([categoria, t]) => ({ categoria, total: t, pct: total > 0 ? Math.round(t / total * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
  }, [raw, mesSeleccionado])

  // ── Top clientes (mes seleccionado) ──────────────────────────
  const topClientes = useMemo<TopCliente[]>(() => {
    const pedidosMes = raw.pedidos.filter(p =>
      p.fecha_confirmacion?.startsWith(mesSeleccionado) && p.cliente_nombre
    )
    const map: Record<string, { total: number; cant: number }> = {}
    pedidosMes.forEach(p => {
      const nombre = p.cliente_nombre as string
      if (!map[nombre]) map[nombre] = { total: 0, cant: 0 }
      map[nombre].total += p.total_cobrado ?? 0
      map[nombre].cant += 1
    })
    return Object.entries(map)
      .map(([cliente_nombre, v]) => ({ cliente_nombre, total_compras: v.total, cant_pedidos: v.cant }))
      .sort((a, b) => b.total_compras - a.total_compras)
      .slice(0, 5)
  }, [raw, mesSeleccionado])

  return {
    mesActual,
    historico,
    desglosePagos,
    desgloseGastos,
    topClientes,
    mesSeleccionado,
    setMesSeleccionado,
    mesesDisponibles,
    loading,
    error,
  }
}

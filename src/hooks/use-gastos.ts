'use client'

// src/hooks/use-gastos.ts

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'

export interface Gasto {
  id: number
  categoria: 'Insumos' | 'Fijo' | 'Flete' | 'Honorarios' | 'Publicidad' | 'Varios'
  descripcion: string
  monto: number
  fecha: string
  recurrente: boolean
  recurrente_id?: number
  proveedor?: string
  comprobante?: string
  metodo_pago: 'efectivo' | 'transferencia' | 'debito' | 'credito'
  notas?: string
  created_at: string
}

export interface GastoRecurrente {
  id: number
  descripcion: string
  categoria: string
  monto_estimado: number
  dia_del_mes: number
  activo: boolean
}

export interface FiltrosGastos {
  busqueda: string
  categoria: string
  metodo_pago: string
  tipo: string // 'recurrente' | 'manual' | ''
  desde: string
  hasta: string
}

const FILTROS_INICIALES: FiltrosGastos = {
  busqueda: '',
  categoria: '',
  metodo_pago: '',
  tipo: '',
  desde: '',
  hasta: '',
}

function normalizar(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function useGastos() {
  const [todos, setTodos] = useState<Gasto[]>([])
  const [recurrentes, setRecurrentes] = useState<GastoRecurrente[]>([])
  const [filtros, setFiltrosState] = useState<FiltrosGastos>(FILTROS_INICIALES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGastos = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)

    // Primer día del mes actual
    const hoy = new Date()
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]

    const [gastosRes, recurrentesRes] = await Promise.all([
      supabase
        .from('gastos')
        .select('*')
        .gte('fecha', primerDiaMes)
        .order('fecha', { ascending: false }),
      supabase
        .from('gastos_recurrentes')
        .select('*')
        .order('dia_del_mes'),
    ])

    if (gastosRes.error) setError('Error al cargar gastos')
    else setTodos(gastosRes.data ?? [])

    setRecurrentes(recurrentesRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchGastos() }, [fetchGastos])

  useRealtime({
    tablas: ['gastos', 'gastos_recurrentes'],
    onCambio: fetchGastos,
  })

  const setFiltros = useCallback((f: Partial<FiltrosGastos>) => {
    setFiltrosState(prev => ({ ...prev, ...f }))
  }, [])

  const limpiarFiltros = useCallback(() => setFiltrosState(FILTROS_INICIALES), [])

  // Filtrado local
  const gastos = todos.filter(g => {
    if (filtros.busqueda) {
      const q = normalizar(filtros.busqueda)
      if (!normalizar(g.descripcion).includes(q) &&
          !normalizar(g.proveedor ?? '').includes(q)) return false
    }
    if (filtros.categoria && g.categoria !== filtros.categoria) return false
    if (filtros.metodo_pago && g.metodo_pago !== filtros.metodo_pago) return false
    if (filtros.tipo === 'recurrente' && !g.recurrente) return false
    if (filtros.tipo === 'manual' && g.recurrente) return false
    if (filtros.desde && g.fecha < filtros.desde) return false
    if (filtros.hasta && g.fecha > filtros.hasta) return false
    return true
  })

  // Stats
  const totalMes = todos.reduce((s, g) => s + g.monto, 0)
  const porMetodo = {
    efectivo:      todos.filter(g => g.metodo_pago === 'efectivo').reduce((s, g) => s + g.monto, 0),
    transferencia: todos.filter(g => g.metodo_pago === 'transferencia').reduce((s, g) => s + g.monto, 0),
    debito:        todos.filter(g => g.metodo_pago === 'debito').reduce((s, g) => s + g.monto, 0),
    credito:       todos.filter(g => g.metodo_pago === 'credito').reduce((s, g) => s + g.monto, 0),
  }

  // CRUD gastos
  const crearGasto = useCallback(async (datos: Omit<Gasto, 'id' | 'created_at'>): Promise<boolean> => {
    const supabase = createClient()
    const { error: err } = await supabase.from('gastos').insert(datos)
    if (err) return false
    await fetchGastos()
    return true
  }, [fetchGastos])

  const editarGasto = useCallback(async (id: number, datos: Partial<Gasto>): Promise<boolean> => {
    const supabase = createClient()
    const { error: err } = await supabase.from('gastos').update(datos).eq('id', id)
    if (err) return false
    await fetchGastos()
    return true
  }, [fetchGastos])

  const eliminarGasto = useCallback(async (id: number): Promise<boolean> => {
    const supabase = createClient()
    const { error: err } = await supabase.from('gastos').delete().eq('id', id)
    if (err) return false
    await fetchGastos()
    return true
  }, [fetchGastos])

  // CRUD recurrentes
  const guardarRecurrente = useCallback(async (
    datos: Partial<GastoRecurrente>, id?: number
  ): Promise<boolean> => {
    const supabase = createClient()
    if (id) {
      const { error: err } = await supabase.from('gastos_recurrentes').update(datos).eq('id', id)
      return !err
    } else {
      const { error: err } = await supabase.from('gastos_recurrentes').insert(datos)
      return !err
    }
  }, [])

  const toggleRecurrente = useCallback(async (id: number, activo: boolean): Promise<boolean> => {
    const supabase = createClient()
    const { error: err } = await supabase
      .from('gastos_recurrentes')
      .update({ activo })
      .eq('id', id)
    if (!err) setRecurrentes(prev => prev.map(r => r.id === id ? { ...r, activo } : r))
    return !err
  }, [])

  const eliminarRecurrente = useCallback(async (id: number): Promise<boolean> => {
    const supabase = createClient()
    const { error: err } = await supabase.from('gastos_recurrentes').delete().eq('id', id)
    if (!err) setRecurrentes(prev => prev.filter(r => r.id !== id))
    return !err
  }, [])

  const generarGastosMes = useCallback(async (): Promise<{ ok: boolean; creados: number }> => {
    const supabase = createClient()
    const { data } = await supabase.rpc('generar_gastos_del_mes')
    return { ok: data?.ok ?? false, creados: data?.creados ?? 0 }
  }, [])

  return {
    gastos, todos, recurrentes,
    totalMes, porMetodo,
    loading, error,
    filtros, setFiltros, limpiarFiltros,
    crearGasto, editarGasto, eliminarGasto,
    guardarRecurrente, toggleRecurrente, eliminarRecurrente,
    generarGastosMes,
    recargar: fetchGastos,
  }
}
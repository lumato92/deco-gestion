'use client'

// src/hooks/use-insumos.ts

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'

export interface Insumo {
  id: number
  nombre: string
  categoria: string
  unidad: string
  stock: number
  costo: number
  minimo: number
  proveedor?: string
  proveedor_id?: number
  proveedor_nombre?: string
  proveedor_contacto?: string
  proveedor_canal?: string
  es_fabricable: boolean
  estado_stock: 'ok' | 'medio' | 'bajo'
  valor_stock: number
}

export interface FiltrosInsumos {
  busqueda: string
  categoria: string
  estado_stock: string
  proveedor: string
}

const FILTROS_INICIALES: FiltrosInsumos = {
  busqueda: '',
  categoria: '',
  estado_stock: '',
  proveedor: '',
}

function normalizar(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function useInsumos() {
  const [todos, setTodos] = useState<Insumo[]>([])
  const [filtros, setFiltrosState] = useState<FiltrosInsumos>(FILTROS_INICIALES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInsumos = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    const { data, error: err } = await supabase
      .from('insumos_con_estado')
      .select('*')
      .order('nombre')
    if (err) setError('Error al cargar insumos')
    else setTodos(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchInsumos() }, [fetchInsumos])

  useRealtime({
    tablas: ['insumos'],
    onCambio: fetchInsumos,
  })

  const setFiltros = useCallback((f: Partial<FiltrosInsumos>) => {
    setFiltrosState(prev => ({ ...prev, ...f }))
  }, [])

  const limpiarFiltros = useCallback(() => setFiltrosState(FILTROS_INICIALES), [])

  // Filtrado local
  const insumos = todos.filter(i => {
    if (filtros.busqueda) {
      const q = normalizar(filtros.busqueda)
      if (!normalizar(i.nombre).includes(q) &&
          !normalizar(i.proveedor ?? '').includes(q) &&
          !normalizar(i.categoria).includes(q)) return false
    }
    if (filtros.categoria && i.categoria !== filtros.categoria) return false
    if (filtros.estado_stock && i.estado_stock !== filtros.estado_stock) return false
    if (filtros.proveedor) {
      const q = normalizar(filtros.proveedor)
      if (!normalizar(i.proveedor ?? '').includes(q)) return false
    }
    return true
  })

  // Categorías únicas
  const categorias = Array.from(new Set(todos.map(i => i.categoria))).sort()

  // Stats
  const stats = {
    total: todos.length,
    valorTotal: todos.reduce((s, i) => s + i.valor_stock, 0),
    stockBajo: todos.filter(i => i.estado_stock === 'bajo').length,
    sinStock: todos.filter(i => i.stock === 0).length,
  }

  // Ajustar stock
  const ajustarStock = useCallback(async (
    insumoId: number,
    operacion: 'entrada' | 'salida' | 'ajuste',
    cantidad: number,
    nuevoCosto?: number
  ): Promise<boolean> => {
    const supabase = createClient()
    const ins = todos.find(i => i.id === insumoId)
    if (!ins) return false

    let nuevoStock: number
    if (operacion === 'entrada') nuevoStock = ins.stock + cantidad
    else if (operacion === 'salida') nuevoStock = Math.max(0, ins.stock - cantidad)
    else nuevoStock = cantidad

    const updates: any = { stock: nuevoStock }
    if (nuevoCosto && nuevoCosto > 0) updates.costo = nuevoCosto

    const { error: err } = await supabase
      .from('insumos')
      .update(updates)
      .eq('id', insumoId)

    if (err) return false

    // Registrar en movimientos
    const tipoMov = operacion === 'entrada' ? 'compra_insumo'
      : operacion === 'salida' ? 'descarte_insumo' : 'ajuste_insumo'

    await supabase.from('movimientos').insert({
      tipo: tipoMov,
      descripcion: `${operacion === 'entrada' ? 'Entrada' : operacion === 'salida' ? 'Salida' : 'Ajuste'}: ${ins.nombre}`,
      referencia_id: insumoId,
      referencia_tipo: 'insumo',
      cantidad: operacion === 'ajuste' ? cantidad - ins.stock : cantidad,
      unidad: ins.unidad,
      costo_unit: nuevoCosto ?? ins.costo,
      origen: 'web',
    })

    await fetchInsumos()
    return true
  }, [todos, fetchInsumos])

  // Guardar insumo (nuevo o editar)
  const guardarInsumo = useCallback(async (
    datos: Partial<Insumo>,
    id?: number
  ): Promise<boolean> => {
    const supabase = createClient()
    if (id) {
      const { error: err } = await supabase.from('insumos').update(datos).eq('id', id)
      return !err
    } else {
      const { error: err } = await supabase.from('insumos').insert(datos)
      return !err
    }
  }, [])

  const eliminarInsumo = useCallback(async (id: number): Promise<boolean> => {
    const supabase = createClient()
    const { error: err } = await supabase.from('insumos').delete().eq('id', id)
    return !err
  }, [])

  return {
    insumos, todos, stats, categorias,
    loading, error, filtros,
    setFiltros, limpiarFiltros,
    ajustarStock, guardarInsumo, eliminarInsumo,
    recargar: fetchInsumos,
  }
}
'use client'

// src/hooks/use-clientes.ts

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'

export interface Cliente {
  id: number
  nombre: string
  telefono?: string
  email?: string
  canal?: string
  notas?: string
  created_at: string
  // calculados desde pedidos
  total_compras?: number
  cant_pedidos?: number
  ultima_compra?: string
  pendiente?: number
}

export interface PedidoCliente {
  id: number
  fecha_pedido: string
  fecha_confirmacion?: string
  estado: string
  canal_venta?: string
  metodo_pago?: string
  total_cobrado: number
  cobrado: number
  pendiente: number
  cant_items: number
  notas?: string
}

export interface FiltrosClientes {
  busqueda: string
  canal: string
  orden: 'nombre' | 'valor' | 'reciente' | 'cantidad'
}

const FILTROS_INICIALES: FiltrosClientes = {
  busqueda: '',
  canal: '',
  orden: 'valor',
}

function normalizar(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function useClientes() {
  const [todos, setTodos] = useState<Cliente[]>([])
  const [filtros, setFiltrosState] = useState<FiltrosClientes>(FILTROS_INICIALES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClientes = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)

    // Clientes + agregados de pedidos
    const { data: clientes, error: err } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre')

    if (err) { setError('Error al cargar clientes'); setLoading(false); return }

    // Pedidos agrupados por cliente
    const { data: pedidos } = await supabase
      .from('pedidos_con_total')
      .select('cliente_id, total_cobrado, cobrado, pendiente, fecha_confirmacion')
      .not('estado', 'eq', 'cancelado')
      .not('estado', 'eq', 'presupuesto')
      .not('cliente_id', 'is', null)

    // Combinar
    const pedidosMap: Record<number, {
      total: number; cant: number; pendiente: number; ultima: string
    }> = {}

    ;(pedidos ?? []).forEach((p: any) => {
      if (!p.cliente_id) return
      if (!pedidosMap[p.cliente_id]) {
        pedidosMap[p.cliente_id] = { total: 0, cant: 0, pendiente: 0, ultima: '' }
      }
      pedidosMap[p.cliente_id].total += p.total_cobrado ?? 0
      pedidosMap[p.cliente_id].cant += 1
      pedidosMap[p.cliente_id].pendiente += p.pendiente ?? 0
      if (p.fecha_confirmacion > (pedidosMap[p.cliente_id].ultima ?? '')) {
        pedidosMap[p.cliente_id].ultima = p.fecha_confirmacion
      }
    })

    const clientesConDatos = (clientes ?? []).map(c => ({
      ...c,
      total_compras: pedidosMap[c.id]?.total ?? 0,
      cant_pedidos:  pedidosMap[c.id]?.cant ?? 0,
      pendiente:     pedidosMap[c.id]?.pendiente ?? 0,
      ultima_compra: pedidosMap[c.id]?.ultima ?? null,
    }))

    setTodos(clientesConDatos)
    setLoading(false)
  }, [])

  useEffect(() => { fetchClientes() }, [fetchClientes])

  useRealtime({
    tablas: ['clientes', 'pedidos'],
    onCambio: fetchClientes,
  })

  const setFiltros = useCallback((f: Partial<FiltrosClientes>) => {
    setFiltrosState(prev => ({ ...prev, ...f }))
  }, [])

  // Filtrado y ordenamiento local
  const clientes = todos
    .filter(c => {
      if (filtros.busqueda) {
        const q = normalizar(filtros.busqueda)
        if (!normalizar(c.nombre).includes(q) &&
            !(c.telefono ?? '').includes(q) &&
            !normalizar(c.email ?? '').includes(q)) return false
      }
      if (filtros.canal && c.canal !== filtros.canal) return false
      return true
    })
    .sort((a, b) => {
      if (filtros.orden === 'nombre')   return a.nombre.localeCompare(b.nombre)
      if (filtros.orden === 'valor')    return (b.total_compras ?? 0) - (a.total_compras ?? 0)
      if (filtros.orden === 'cantidad') return (b.cant_pedidos ?? 0) - (a.cant_pedidos ?? 0)
      if (filtros.orden === 'reciente') return (b.ultima_compra ?? '') > (a.ultima_compra ?? '') ? 1 : -1
      return 0
    })

  // Stats
  const stats = {
    total: todos.length,
    conCompras: todos.filter(c => (c.cant_pedidos ?? 0) > 0).length,
    ticketPromedio: (() => {
      const conCompras = todos.filter(c => (c.cant_pedidos ?? 0) > 0)
      if (conCompras.length === 0) return 0
      const totalIngresos = conCompras.reduce((s, c) => s + (c.total_compras ?? 0), 0)
      const totalPedidos = conCompras.reduce((s, c) => s + (c.cant_pedidos ?? 0), 0)
      return totalPedidos > 0 ? Math.round(totalIngresos / totalPedidos) : 0
    })(),
    conPendiente: todos.filter(c => (c.pendiente ?? 0) > 0).length,
  }

  // Historial de un cliente
  const fetchHistorial = useCallback(async (clienteId: number): Promise<PedidoCliente[]> => {
    const supabase = createClient()
    const { data } = await supabase
      .from('pedidos_con_total')
      .select('id, fecha_pedido, fecha_confirmacion, estado, canal_venta, metodo_pago, total_cobrado, cobrado, pendiente, cant_items, notas')
      .eq('cliente_id', clienteId)
      .not('estado', 'eq', 'cancelado')
      .order('fecha_pedido', { ascending: false })
      .limit(10)
    return (data ?? []) as PedidoCliente[]
  }, [])

  // CRUD
  const guardarCliente = useCallback(async (
    datos: Partial<Cliente>, id?: number
  ): Promise<boolean> => {
    const supabase = createClient()
    if (id) {
      const { error: err } = await supabase.from('clientes').update(datos).eq('id', id)
      return !err
    } else {
      const { error: err } = await supabase.from('clientes').insert(datos)
      return !err
    }
  }, [])

  const eliminarCliente = useCallback(async (id: number): Promise<boolean> => {
    const supabase = createClient()
    const { error: err } = await supabase.from('clientes').delete().eq('id', id)
    return !err
  }, [])

  return {
    clientes, todos, stats,
    loading, error,
    filtros, setFiltros,
    fetchHistorial,
    guardarCliente, eliminarCliente,
    recargar: fetchClientes,
  }
}
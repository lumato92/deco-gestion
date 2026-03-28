'use client'

// src/hooks/use-presupuestos.ts

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'
import type { PedidoConTotal, MetodoPago, CanalVenta } from '@/lib/types'

export interface FormPresupuesto {
  cliente_id: number | null
  canal_venta: CanalVenta
  tipo_entrega: 'stock' | 'fabricacion'
  fecha_entrega: string
  fecha_compromiso_fabricacion: string
  notas: string
  items: ItemPresupuesto[]
  descuento_tipo: 'pct' | 'monto'
  descuento_valor: number
}

export interface ItemPresupuesto {
  producto_id: number | null
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  costo_unitario: number
  requiere_fabricacion: boolean
}

const FORM_INICIAL: FormPresupuesto = {
  cliente_id: null,
  canal_venta: 'whatsapp',
  tipo_entrega: 'stock',
  fecha_entrega: '',
  fecha_compromiso_fabricacion: '',
  notas: '',
  items: [],
  descuento_tipo: 'pct',
  descuento_valor: 0,
}

// ── Hook listado de presupuestos ──────────────────────────────

export function usePresupuestos() {
  const [presupuestos, setPresupuestos] = useState<PedidoConTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPresupuestos = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    const { data, error: err } = await supabase
      .from('pedidos_con_total')
      .select('*')
      .eq('estado', 'presupuesto')
      .order('fecha_pedido', { ascending: false })
    if (err) setError('Error al cargar presupuestos')
    else setPresupuestos(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPresupuestos() }, [fetchPresupuestos])

  useRealtime({
    tablas: ['pedidos', 'items_pedido'],
    onCambio: fetchPresupuestos,
  })

  const confirmar = useCallback(async (
    pedidoId: number,
    destino: 'confirmado' | 'en_fabricacion'
  ): Promise<{ ok: boolean; error?: string }> => {
    const supabase = createClient()
    const { data, error: err } = await supabase
      .rpc('confirmar_pedido', {
        p_pedido_id: pedidoId,
        p_estado_destino: destino,
      })
    if (err) return { ok: false, error: err.message }
    if (!data?.ok) return { ok: false, error: JSON.stringify(data?.errores ?? data?.mensaje) }
    await fetchPresupuestos()
    return { ok: true }
  }, [fetchPresupuestos])

  const cancelar = useCallback(async (pedidoId: number) => {
    const supabase = createClient()
    await supabase.rpc('cancelar_pedido', { p_pedido_id: pedidoId })
    await fetchPresupuestos()
  }, [fetchPresupuestos])

  return { presupuestos, loading, error, confirmar, cancelar, recargar: fetchPresupuestos }
}

// ── Hook formulario nuevo presupuesto ─────────────────────────

export function useNuevoPresupuesto() {
  const [form, setFormState] = useState<FormPresupuesto>(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setForm = useCallback((cambios: Partial<FormPresupuesto>) => {
    setFormState(prev => ({ ...prev, ...cambios }))
  }, [])

  const resetForm = useCallback(() => {
    setFormState(FORM_INICIAL)
    setError(null)
  }, [])

  const agregarItem = useCallback((item: ItemPresupuesto) => {
    setFormState(prev => ({ ...prev, items: [...prev.items, item] }))
  }, [])

  const quitarItem = useCallback((idx: number) => {
    setFormState(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }, [])

  const actualizarItem = useCallback((idx: number, cambios: Partial<ItemPresupuesto>) => {
    setFormState(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, ...cambios } : item),
    }))
  }, [])

  // Cálculos
  const subtotal = form.items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
  const descuentoMonto = form.descuento_tipo === 'pct'
    ? subtotal * form.descuento_valor / 100
    : form.descuento_valor
  const descuentoPct = form.descuento_tipo === 'monto' && subtotal > 0
    ? (form.descuento_valor / subtotal) * 100
    : form.descuento_valor
  const total = Math.round(subtotal - descuentoMonto)
  const adelanto50 = Math.round(total / 2)

  const guardarPresupuesto = useCallback(async (): Promise<boolean> => {
    if (form.items.length === 0) { setError('Agregá al menos un producto'); return false }
    if (!form.cliente_id && form.tipo_entrega === 'fabricacion') {
      setError('Los encargos a fabricar requieren un cliente identificado')
      return false
    }

    setGuardando(true)
    setError(null)
    const supabase = createClient()

    try {
      const { data: pedido, error: errPedido } = await supabase
        .from('pedidos')
        .insert({
          cliente_id: form.cliente_id,
          origen_venta: 'presupuesto',
          estado: 'presupuesto',
          canal_venta: form.canal_venta,
          descuento_pct: Math.round(descuentoPct * 100) / 100,
          recargo_pct: 0,
          notas: form.notas || null,
          fecha_entrega: form.fecha_entrega || null,
          fecha_compromiso_fabricacion: form.fecha_compromiso_fabricacion || null,
        })
        .select('id')
        .single()

      if (errPedido || !pedido) throw new Error(errPedido?.message ?? 'Error al crear presupuesto')

      const { error: errItems } = await supabase
        .from('items_pedido')
        .insert(
          form.items.map(item => ({
            pedido_id: pedido.id,
            producto_id: item.producto_id,
            nombre_producto: item.nombre_producto,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            costo_unitario: item.costo_unitario,
            requiere_fabricacion: item.requiere_fabricacion,
          }))
        )

      if (errItems) throw new Error(errItems.message)
      return true
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar el presupuesto')
      return false
    } finally {
      setGuardando(false)
    }
  }, [form, descuentoPct])

  return {
    form, setForm, resetForm,
    agregarItem, quitarItem, actualizarItem,
    guardarPresupuesto, guardando, error,
    subtotal, descuentoMonto, total, adelanto50,
  }
}
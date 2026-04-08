'use client'

// src/hooks/use-nueva-venta.ts

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MetodoPago, CanalVenta } from '@/lib/types'

export interface ItemVenta {
  producto_id: number | null
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  costo_unitario: number
  requiere_fabricacion: boolean
}

export interface FormVenta {
  cliente_id: number | null
  cliente_nombre_temp: string
  canal_venta: CanalVenta
  metodo_pago: MetodoPago
  descuento_tipo: 'pct' | 'monto'
  descuento_valor: number
  con_sena: boolean
  monto_sena: number
  notas: string
  entrega_inmediata: boolean
  items: ItemVenta[]
}

const FORM_INICIAL: FormVenta = {
  cliente_id: null,
  cliente_nombre_temp: '',
  canal_venta: 'directo',
  metodo_pago: 'efectivo',
  descuento_tipo: 'pct',
  descuento_valor: 0,
  con_sena: false,
  monto_sena: 0,
  notas: '',
  entrega_inmediata: false,
  items: [],
}

const RECARGO: Record<MetodoPago, number> = {
  efectivo: 0,
  transferencia: 0,
  debito: 10,
  credito: 20,
  mercadopago: 0,
}

export function useNuevaVenta() {
  const [form, setFormState] = useState<FormVenta>(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setForm = useCallback((cambios: Partial<FormVenta>) => {
    setFormState(prev => ({ ...prev, ...cambios }))
  }, [])

  const resetForm = useCallback(() => {
    setFormState(FORM_INICIAL)
    setError(null)
  }, [])

  // ── Cálculos ──────────────────────────────────────────────

  const subtotal = form.items.reduce(
    (s, i) => s + i.cantidad * i.precio_unitario, 0
  )

  const descuentoMonto = form.descuento_tipo === 'pct'
    ? subtotal * form.descuento_valor / 100
    : form.descuento_valor

  const descuentoPct = form.descuento_tipo === 'monto' && subtotal > 0
    ? (form.descuento_valor / subtotal) * 100
    : form.descuento_valor

  const recargoPct = RECARGO[form.metodo_pago]
  const conDescuento = subtotal - descuentoMonto
  const recargoMonto = conDescuento * recargoPct / 100
  const total = Math.round(conDescuento + recargoMonto)

  // ── Items ─────────────────────────────────────────────────

  const agregarItem = useCallback((item: ItemVenta) => {
    setFormState(prev => ({
      ...prev,
      items: [...prev.items, item],
    }))
  }, [])

  const quitarItem = useCallback((idx: number) => {
    setFormState(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }))
  }, [])

  const actualizarItem = useCallback((idx: number, cambios: Partial<ItemVenta>) => {
    setFormState(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === idx ? { ...item, ...cambios } : item
      ),
    }))
  }, [])

  // ── Confirmar venta ───────────────────────────────────────
  // Retorna el id del pedido creado, o false si hubo error

  const confirmarVenta = useCallback(async (): Promise<number | false> => {
    if (form.items.length === 0) {
      setError('Agregá al menos un producto')
      return false
    }

    setGuardando(true)
    setError(null)
    const supabase = createClient()

    const ahora = new Date().toISOString()
    const estadoInicial = form.entrega_inmediata ? 'entregado' : 'confirmado'

    try {
      // 1. Crear el pedido
      const { data: pedido, error: errPedido } = await supabase
        .from('pedidos')
        .insert({
          cliente_id: form.cliente_id,
          origen_venta: 'directa',
          estado: estadoInicial,
          canal_venta: form.canal_venta,
          metodo_pago: form.metodo_pago,
          descuento_pct: Math.round(descuentoPct * 100) / 100,
          recargo_pct: recargoPct,
          notas: form.notas || null,
          fecha_confirmacion: ahora,
          ...(form.entrega_inmediata ? { fecha_entrega: ahora } : {}),
        })
        .select('id')
        .single()

      if (errPedido || !pedido) throw new Error(errPedido?.message ?? 'Error al crear el pedido')

      // 2. Insertar items
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

      // 3. Registrar pago — si es MP lo omitimos, el webhook lo registra cuando se acredite
      if (form.metodo_pago !== 'mercadopago') {
        const { error: errPago } = await supabase
          .from('pagos_pedido')
          .insert({
            pedido_id: pedido.id,
            tipo: form.con_sena ? 'seña' : 'pago_total',
            metodo_pago: form.metodo_pago,
            monto: form.con_sena ? form.monto_sena : total,
          })

        if (errPago) throw new Error(errPago.message)
      }

      // 4. Descontar stock via función de Supabase
      const { data: resultado } = await supabase
        .rpc('descontar_stock_pedido', { p_pedido_id: pedido.id })

      if (resultado && !resultado.ok) {
        setError(`Stock insuficiente: ${JSON.stringify(resultado.errores)}`)
      }

      return pedido.id
    } catch (e: any) {
      setError(e.message ?? 'Error al confirmar la venta')
      return false
    } finally {
      setGuardando(false)
    }
  }, [form, total, descuentoPct, recargoPct])

  return {
    form,
    setForm,
    resetForm,
    agregarItem,
    quitarItem,
    actualizarItem,
    confirmarVenta,
    guardando,
    error,
    // calculados
    subtotal,
    descuentoMonto,
    descuentoPct,
    recargoPct,
    recargoMonto,
    total,
  }
}
'use client'

// src/hooks/use-nueva-venta.ts

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { crearPedidoCompleto } from '@/lib/pedidos/crear-pedido'
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
  fecha: string
  desde_point: boolean
  items: ItemVenta[]
}

function fechaHoy() {
  return new Date().toISOString().split('T')[0]
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
  fecha: fechaHoy(),
  desde_point: false,
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
  const [form, setFormState] = useState<FormVenta>({ ...FORM_INICIAL, fecha: fechaHoy() })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setForm = useCallback((cambios: Partial<FormVenta>) => {
    setFormState(prev => ({ ...prev, ...cambios }))
  }, [])

  const resetForm = useCallback(() => {
    setFormState({ ...FORM_INICIAL, fecha: fechaHoy() })
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
    setFormState(prev => ({ ...prev, items: [...prev.items, item] }))
  }, [])

  const quitarItem = useCallback((idx: number) => {
    setFormState(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }, [])

  const actualizarItem = useCallback((idx: number, cambios: Partial<ItemVenta>) => {
    setFormState(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, ...cambios } : item),
    }))
  }, [])

  // ── Confirmar venta ───────────────────────────────────────

  const confirmarVenta = useCallback(async (): Promise<number | false> => {
    if (form.items.length === 0) {
      setError('Agregá al menos un producto')
      return false
    }

    setGuardando(true)
    setError(null)
    const supabase = createClient()

    const fechaBase = form.fecha || fechaHoy()
    const fechaConfirmacion = new Date(`${fechaBase}T${new Date().toTimeString().split(' ')[0]}`).toISOString()

    try {
      // Si viene desde Point NO registramos el pago acá —
      // lo registra la route /api/pagos/point/asignar para evitar duplicado
      const registrarPago = form.metodo_pago !== 'mercadopago' && !form.desde_point

      const resultado = await crearPedidoCompleto(supabase, {
        cliente_id: form.cliente_id,
        origen_venta: 'directa',
        canal_venta: form.canal_venta,
        metodo_pago: form.metodo_pago,
        descuento_pct: descuentoPct,
        recargo_pct: recargoPct,
        notas: form.notas,
        fecha: fechaConfirmacion,
        entrega_inmediata: form.entrega_inmediata,
        items: form.items,
        pago: registrarPago
          ? {
              tipo: form.con_sena ? 'seña' : 'pago_total',
              metodo_pago: form.metodo_pago,
              monto: form.con_sena ? form.monto_sena : total,
            }
          : null,
      })

      if (!resultado.ok) {
        setError(resultado.error)
        // Con stock insuficiente el pedido igual quedó creado: devolvemos el id
        // para que la UI navegue al pedido, con el error visible.
        return resultado.stockInsuficiente ? resultado.pedidoId : false
      }

      return resultado.pedidoId
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al confirmar la venta')
      return false
    } finally {
      setGuardando(false)
    }
  }, [form, total, descuentoPct, recargoPct])

  return {
    form, setForm, resetForm,
    agregarItem, quitarItem, actualizarItem,
    confirmarVenta, guardando, error,
    subtotal, descuentoMonto, descuentoPct,
    recargoPct, recargoMonto, total,
  }
}
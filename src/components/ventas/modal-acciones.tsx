'use client'

// src/components/ventas/modal-acciones.tsx

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMonto } from '@/lib/utils'
import type { PedidoConTotal } from '@/lib/types'

interface ItemPedido {
  id: number
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  costo_unitario: number
  producto_id: number | null
}

type Accion = 'menu' | 'eliminar' | 'cancelar' | 'devolucion' | 'cambio'

interface Props {
  venta: PedidoConTotal
  onCompletado: () => void
  onCerrar: () => void
}

export function ModalAccionesVenta({ venta, onCompletado, onCerrar }: Props) {
  const [accion, setAccion] = useState<Accion>('menu')
  const [items, setItems] = useState<ItemPedido[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [cantDevuelta, setCantDevuelta] = useState<Record<number, number>>({})
  const [busquedaProd, setBusquedaProd] = useState('')
  const [todosProds, setTodosProds] = useState<any[]>([])
  const [resultadosProd, setResultadosProd] = useState<any[]>([])
  const [itemsCambio, setItemsCambio] = useState<any[]>([])
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [eliminacionDefinitiva, setEliminacionDefinitiva] = useState(false)

  function normalizar(str: string) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('items_pedido')
      .select('id, nombre_producto, cantidad, precio_unitario, costo_unitario, producto_id')
      .eq('pedido_id', venta.id)
      .then(({ data }) => {
        const its = data ?? []
        setItems(its)
        const init: Record<number, number> = {}
        its.forEach(i => { init[i.id] = i.cantidad })
        setCantDevuelta(init)
        setLoadingItems(false)
      })

    supabase
      .from('productos_con_margen')
      .select('id, nombre, categoria_nombre, stock, costo, precio')
      .eq('estado', 'activo')
      .limit(200)
      .then(({ data }) => setTodosProds(data ?? []))
  }, [venta.id])

  useEffect(() => {
    if (busquedaProd.length < 2) { setResultadosProd([]); return }
    const q = normalizar(busquedaProd)
    setResultadosProd(todosProds.filter(p => normalizar(p.nombre).includes(q)).slice(0, 6))
  }, [busquedaProd, todosProds])

  const totalDevuelto = items.reduce((s, i) => {
    return s + (cantDevuelta[i.id] ?? 0) * i.precio_unitario
  }, 0)

  const totalCambio = itemsCambio.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
  const diferenciaCambio = totalCambio - totalDevuelto

  // ── Restaurar stock ───────────────────────────────────────────

  async function restaurarStock(supabase: any, itemsARestaurar: ItemPedido[], cantidades: Record<number, number>) {
    for (const item of itemsARestaurar) {
      if (!item.producto_id) continue
      const cant = cantidades[item.id] ?? 0
      if (cant <= 0) continue
      const { data: prod } = await supabase
        .from('productos').select('stock').eq('id', item.producto_id).single()
      if (prod) {
        await supabase.from('productos')
          .update({ stock: prod.stock + cant })
          .eq('id', item.producto_id)
      }
    }
  }

  // ── Eliminar ──────────────────────────────────────────────────

  const handleEliminar = async () => {
    setProcesando(true)
    setError('')
    const supabase = createClient()
    try {
      if (eliminacionDefinitiva) {
        // Borrar todo — sin restaurar stock
        await supabase.from('pagos_pedido').delete().eq('pedido_id', venta.id)
        await supabase.from('items_pedido').delete().eq('pedido_id', venta.id)
        const { error: err } = await supabase.from('pedidos').delete().eq('id', venta.id)
        if (err) throw new Error(err.message)
      } else {
        // Cancelar: restaurar stock + eliminar pagos + marcar cancelado
        await restaurarStock(supabase, items, cantDevuelta)
        await supabase.from('pagos_pedido').delete().eq('pedido_id', venta.id)
        const { error: err } = await supabase
          .from('pedidos')
          .update({ estado: 'cancelado' })
          .eq('id', venta.id)
        if (err) throw new Error(err.message)
      }
      onCompletado()
      onCerrar()
    } catch (e: any) {
      setError(e.message ?? 'Error al procesar')
      setProcesando(false)
    }
  }

  // ── Cancelar ──────────────────────────────────────────────────

  const handleCancelar = async () => {
    setProcesando(true)
    setError('')
    const supabase = createClient()
    try {
      // 1. Restaurar stock de todos los items
      const todasCantidades: Record<number, number> = {}
      items.forEach(i => { todasCantidades[i.id] = i.cantidad })
      await restaurarStock(supabase, items, todasCantidades)

      // 2. Eliminar pagos — el dinero ya no está en caja
      await supabase.from('pagos_pedido').delete().eq('pedido_id', venta.id)

      // 3. Marcar como cancelado
      const { error: err } = await supabase
        .from('pedidos')
        .update({
          estado: 'cancelado',
          notas: (venta.notas ? venta.notas + ' | ' : '') + 'Cancelado con devolución de stock',
        })
        .eq('id', venta.id)
      if (err) throw new Error(err.message)

      onCompletado()
      onCerrar()
    } catch (e: any) {
      setError(e.message ?? 'Error al cancelar')
      setProcesando(false)
    }
  }

  // ── Devolución ────────────────────────────────────────────────

  const handleDevolucion = async () => {
    const itemsADevolver = items.filter(i => (cantDevuelta[i.id] ?? 0) > 0)
    if (itemsADevolver.length === 0) { setError('Seleccioná al menos un item para devolver'); return }

    setProcesando(true)
    setError('')
    const supabase = createClient()
    try {
      const esTotal = items.every(i => (cantDevuelta[i.id] ?? 0) === i.cantidad)

      // 1. Restaurar stock
      await restaurarStock(supabase, itemsADevolver, cantDevuelta)

      if (esTotal) {
        // Devolución total: eliminar todos los pagos y cancelar el pedido
        await supabase.from('pagos_pedido').delete().eq('pedido_id', venta.id)
        await supabase.from('pedidos')
          .update({
            estado: 'cancelado',
            notas: (venta.notas ? venta.notas + ' | ' : '') + 'Devolución total',
          })
          .eq('id', venta.id)
      } else {
        // Devolución parcial: actualizar cantidades de items
        for (const item of items) {
          const cant = cantDevuelta[item.id] ?? 0
          const cantRestante = item.cantidad - cant
          if (cantRestante <= 0) {
            await supabase.from('items_pedido').delete().eq('id', item.id)
          } else {
            await supabase.from('items_pedido').update({ cantidad: cantRestante }).eq('id', item.id)
          }
        }

        // Ajustar pagos: el nuevo total es el total original menos lo devuelto
        const nuevoTotal = venta.total_cobrado - totalDevuelto

        // Eliminar pagos anteriores y crear uno nuevo con el monto ajustado
        await supabase.from('pagos_pedido').delete().eq('pedido_id', venta.id)
        if (nuevoTotal > 0) {
          await supabase.from('pagos_pedido').insert({
            pedido_id: venta.id,
            tipo: 'pago_total',
            metodo_pago: venta.metodo_pago ?? 'efectivo',
            monto: nuevoTotal,
            notas: `Ajuste por devolución parcial de ${formatMonto(totalDevuelto)}`,
          })
        }

        // Actualizar nota del pedido
        await supabase.from('pedidos')
          .update({
            notas: (venta.notas ? venta.notas + ' | ' : '') +
              `Devolución parcial: ${formatMonto(totalDevuelto)}`,
          })
          .eq('id', venta.id)
      }

      // Registrar movimiento
      await supabase.from('movimientos').insert({
        tipo: 'devolucion',
        descripcion: `Devolución ${esTotal ? 'total' : 'parcial'} — pedido #${venta.id}`,
        referencia_id: venta.id,
        referencia_tipo: 'pedido',
        cantidad: itemsADevolver.reduce((s, i) => s + (cantDevuelta[i.id] ?? 0), 0),
        origen: 'web',
      })

      onCompletado()
      onCerrar()
    } catch (e: any) {
      setError(e.message ?? 'Error al procesar la devolución')
      setProcesando(false)
    }
  }

  // ── Cambio ────────────────────────────────────────────────────

  const handleCambio = async () => {
    if (itemsCambio.length === 0) { setError('Agregá los productos de reemplazo'); return }
    const itemsADevolver = items.filter(i => (cantDevuelta[i.id] ?? 0) > 0)
    if (itemsADevolver.length === 0) { setError('Seleccioná los items a devolver'); return }

    setProcesando(true)
    setError('')
    const supabase = createClient()
    try {
      // 1. Restaurar stock de lo devuelto
      await restaurarStock(supabase, itemsADevolver, cantDevuelta)

      // 2. Crear nuevo pedido con los productos de cambio
      const { data: nuevoPedido, error: errPedido } = await supabase
        .from('pedidos')
        .insert({
          cliente_id: venta.cliente_id,
          origen_venta: 'directa',
          estado: 'confirmado',
          canal_venta: venta.canal_venta,
          metodo_pago: venta.metodo_pago,
          descuento_pct: 0,
          recargo_pct: 0,
          notas: `Cambio por pedido #${venta.id}`,
          fecha_confirmacion: new Date().toISOString(),
        })
        .select('id').single()

      if (errPedido || !nuevoPedido) throw new Error(errPedido?.message ?? 'Error al crear pedido')

      await supabase.from('items_pedido').insert(
        itemsCambio.map((i: any) => ({
          pedido_id: nuevoPedido.id,
          producto_id: i.producto_id,
          nombre_producto: i.nombre,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          costo_unitario: i.costo,
        }))
      )

      // Descontar stock de los nuevos productos
      await supabase.rpc('descontar_stock_pedido', { p_pedido_id: nuevoPedido.id })

      // Si el nuevo pedido tiene diferencia positiva, el cliente debe pagar esa diferencia
      // Si es negativa, hay que devolver plata — se registra como pago negativo
      if (diferenciaCambio !== 0) {
        await supabase.from('pagos_pedido').insert({
          pedido_id: nuevoPedido.id,
          tipo: diferenciaCambio > 0 ? 'saldo' : 'devolucion',
          metodo_pago: venta.metodo_pago ?? 'efectivo',
          monto: Math.abs(diferenciaCambio),
          notas: diferenciaCambio > 0
            ? `Diferencia a cobrar por cambio de pedido #${venta.id}`
            : `Diferencia a devolver por cambio de pedido #${venta.id}`,
        })
      }

      // 3. Cancelar pedido original
      const esTotal = items.every(i => (cantDevuelta[i.id] ?? 0) === i.cantidad)

      if (esTotal) {
        // Eliminar pagos del pedido original y cancelarlo
        await supabase.from('pagos_pedido').delete().eq('pedido_id', venta.id)
        await supabase.from('pedidos')
          .update({
            estado: 'cancelado',
            notas: (venta.notas ?? '') + ` | Cambio por pedido #${nuevoPedido.id}`,
          })
          .eq('id', venta.id)
      } else {
        // Cambio parcial: actualizar cantidades
        for (const item of items) {
          const cantRestante = item.cantidad - (cantDevuelta[item.id] ?? 0)
          if (cantRestante <= 0) {
            await supabase.from('items_pedido').delete().eq('id', item.id)
          } else {
            await supabase.from('items_pedido').update({ cantidad: cantRestante }).eq('id', item.id)
          }
        }

        // Ajustar pagos del pedido original
        const nuevoTotal = venta.total_cobrado - totalDevuelto
        await supabase.from('pagos_pedido').delete().eq('pedido_id', venta.id)
        if (nuevoTotal > 0) {
          await supabase.from('pagos_pedido').insert({
            pedido_id: venta.id,
            tipo: 'pago_total',
            metodo_pago: venta.metodo_pago ?? 'efectivo',
            monto: nuevoTotal,
            notas: `Ajuste por cambio parcial`,
          })
        }

        await supabase.from('pedidos')
          .update({
            notas: (venta.notas ?? '') + ` | Cambio parcial por pedido #${nuevoPedido.id}`,
          })
          .eq('id', venta.id)
      }

      onCompletado()
      onCerrar()
    } catch (e: any) {
      setError(e.message ?? 'Error al procesar el cambio')
      setProcesando(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              {accion === 'menu'       && `Venta #${venta.id}`}
              {accion === 'eliminar'   && 'Eliminar venta'}
              {accion === 'cancelar'   && 'Cancelar venta'}
              {accion === 'devolucion' && 'Registrar devolución'}
              {accion === 'cambio'     && 'Registrar cambio'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {venta.cliente_nombre ?? '(sin cliente)'} · {formatMonto(venta.total_cobrado)}
            </p>
          </div>
          {accion !== 'menu' && (
            <button onClick={() => { setAccion('menu'); setError('') }}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1">
              ← Volver
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 p-5">

          {/* ── MENÚ ── */}
          {accion === 'menu' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-400 mb-1">¿Qué querés hacer con esta venta?</p>

              <button onClick={() => setAccion('devolucion')}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-teal-300 hover:bg-teal-50 text-left transition-colors">
                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700 flex-shrink-0 mt-0.5 text-sm">↩</div>
                <div>
                  <div className="text-[13px] font-medium text-gray-900">Devolución</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">El cliente devuelve productos. Se restaura el stock y se ajusta el importe.</div>
                </div>
              </button>

              <button onClick={() => setAccion('cambio')}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-left transition-colors">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0 mt-0.5 text-sm">⇄</div>
                <div>
                  <div className="text-[13px] font-medium text-gray-900">Cambio</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Devuelve productos y lleva otros. Se genera un nuevo pedido con la diferencia.</div>
                </div>
              </button>

              <button onClick={() => setAccion('cancelar')}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-left transition-colors">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0 mt-0.5 text-sm">✕</div>
                <div>
                  <div className="text-[13px] font-medium text-gray-900">Cancelar venta</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Cancela el pedido, restaura el stock y revierte el importe cobrado.</div>
                </div>
              </button>

              <button onClick={() => setAccion('eliminar')}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50 text-left transition-colors">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-700 flex-shrink-0 mt-0.5 text-sm">🗑</div>
                <div>
                  <div className="text-[13px] font-medium text-gray-900">Eliminar</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Borra la venta del sistema. Podés elegir si restaurar el stock o no.</div>
                </div>
              </button>
            </div>
          )}

          {/* ── ELIMINAR ── */}
          {accion === 'eliminar' && (
            <div className="flex flex-col gap-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-[12px] text-red-800">
                <div className="font-medium mb-1">⚠️ Esta acción no se puede deshacer</div>
                Elegí cómo querés manejar el stock y el registro.
              </div>

              <div className="flex flex-col gap-2">
                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${!eliminacionDefinitiva ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="tipo-eliminar" checked={!eliminacionDefinitiva}
                    onChange={() => setEliminacionDefinitiva(false)} className="mt-0.5" />
                  <div>
                    <div className="text-[13px] font-medium text-gray-900">Cancelar con restauración de stock</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">La venta queda como "Cancelada". El stock y los importes se revierten.</div>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${eliminacionDefinitiva ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:bg-red-50'}`}>
                  <input type="radio" name="tipo-eliminar" checked={eliminacionDefinitiva}
                    onChange={() => setEliminacionDefinitiva(true)} className="mt-0.5" />
                  <div>
                    <div className="text-[13px] font-medium text-red-700">Eliminar definitivamente</div>
                    <div className="text-[11px] text-red-400 mt-0.5">Borra todo sin restaurar stock ni revertir importes. No se puede deshacer.</div>
                  </div>
                </label>
              </div>

              {error && <p className="text-[11px] text-red-600">{error}</p>}

              <button onClick={handleEliminar} disabled={procesando}
                className={`w-full py-2.5 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors ${
                  eliminacionDefinitiva
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}>
                {procesando
                  ? 'Procesando...'
                  : eliminacionDefinitiva ? 'Eliminar definitivamente' : 'Cancelar y restaurar'
                }
              </button>
            </div>
          )}

          {/* ── CANCELAR ── */}
          {accion === 'cancelar' && (
            <div className="flex flex-col gap-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[12px] text-amber-800">
                Se marcará como <strong>Cancelada</strong>. Se restaura el stock y se revierten los importes cobrados.
              </div>

              {loadingItems ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Se va a revertir</div>
                  {items.map(i => (
                    <div key={i.id} className="flex justify-between text-[12px] py-1.5 border-b border-gray-100 last:border-0">
                      <span className="text-gray-700">{i.nombre_producto}</span>
                      <div className="flex gap-4">
                        <span className="text-gray-400">+{i.cantidad} u. en stock</span>
                        <span className="text-teal-700">−{formatMonto(i.cantidad * i.precio_unitario)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between text-[12px] pt-2 font-medium">
                    <span className="text-gray-700">Total a revertir</span>
                    <span className="text-teal-700">−{formatMonto(venta.cobrado)}</span>
                  </div>
                </div>
              )}

              {error && <p className="text-[11px] text-red-600">{error}</p>}

              <button onClick={handleCancelar} disabled={procesando}
                className="w-full py-2.5 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                {procesando ? 'Procesando...' : 'Confirmar cancelación'}
              </button>
            </div>
          )}

          {/* ── DEVOLUCIÓN ── */}
          {accion === 'devolucion' && (
            <div className="flex flex-col gap-4">
              <p className="text-[12px] text-gray-500">
                Ajustá la cantidad devuelta por producto. El stock se restaura y el importe se descuenta.
              </p>

              {loadingItems ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map(i => (
                    <div key={i.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                      <div className="flex-1">
                        <div className="text-[12px] font-medium text-gray-900">{i.nombre_producto}</div>
                        <div className="text-[11px] text-gray-400">{formatMonto(i.precio_unitario)} c/u · compró {i.cantidad}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400">Devuelve</span>
                        <input
                          type="number" min={0} max={i.cantidad}
                          value={cantDevuelta[i.id] ?? 0}
                          onChange={e => setCantDevuelta(prev => ({
                            ...prev, [i.id]: Math.min(i.cantidad, Math.max(0, Number(e.target.value)))
                          }))}
                          className="w-16 text-center text-[13px] text-gray-900 bg-white border border-gray-300 rounded-lg px-1 py-1 focus:outline-none focus:border-teal-400"
                        />
                        <span className="text-[11px] text-gray-400">/ {i.cantidad}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {totalDevuelto > 0 && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 flex justify-between text-[12px]">
                  <span className="text-teal-800">Importe a revertir</span>
                  <span className="font-medium text-teal-900">−{formatMonto(totalDevuelto)}</span>
                </div>
              )}

              {error && <p className="text-[11px] text-red-600">{error}</p>}

              <button onClick={handleDevolucion} disabled={procesando || totalDevuelto === 0}
                className="w-full py-2.5 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                {procesando ? 'Procesando...' : `Confirmar devolución · −${formatMonto(totalDevuelto)}`}
              </button>
            </div>
          )}

          {/* ── CAMBIO ── */}
          {accion === 'cambio' && (
            <div className="flex flex-col gap-4">

              <div>
                <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">¿Qué devuelve?</div>
                {loadingItems ? (
                  <div className="h-20 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <div className="flex flex-col gap-1 bg-gray-50 rounded-xl p-3">
                    {items.map(i => (
                      <div key={i.id} className="flex items-center gap-3 py-1.5">
                        <div className="flex-1 text-[12px] font-medium text-gray-900">{i.nombre_producto}</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min={0} max={i.cantidad}
                            value={cantDevuelta[i.id] ?? 0}
                            onChange={e => setCantDevuelta(prev => ({
                              ...prev, [i.id]: Math.min(i.cantidad, Math.max(0, Number(e.target.value)))
                            }))}
                            className="w-14 text-center text-[12px] text-gray-900 bg-white border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:border-teal-400"
                          />
                          <span className="text-[11px] text-gray-400">/ {i.cantidad}</span>
                        </div>
                      </div>
                    ))}
                    {totalDevuelto > 0 && (
                      <div className="flex justify-between text-[11px] pt-2 border-t border-gray-200 mt-1">
                        <span className="text-gray-500">Valor devuelto</span>
                        <span className="font-medium text-gray-700">{formatMonto(totalDevuelto)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">¿Qué se lleva?</div>
                <div className="relative mb-2">
                  <input type="text" placeholder="Buscar producto de reemplazo..."
                    value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)}
                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
                  {resultadosProd.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg z-10 overflow-hidden shadow-sm">
                      {resultadosProd.map(p => (
                        <button key={p.id}
                          onClick={() => {
                            setItemsCambio(prev => {
                              const existe = prev.find((i: any) => i.producto_id === p.id)
                              if (existe) return prev.map((i: any) => i.producto_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)
                              return [...prev, { producto_id: p.id, nombre: p.nombre, cantidad: 1, precio_unitario: p.precio, costo: p.costo }]
                            })
                            setBusquedaProd('')
                            setResultadosProd([])
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
                          <div className="text-[12px] font-medium text-gray-900">{p.nombre}</div>
                          <div className="text-[12px] text-gray-500">{formatMonto(p.precio)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {itemsCambio.length > 0 && (
                  <div className="flex flex-col gap-1 bg-blue-50 rounded-xl p-3">
                    {itemsCambio.map((i: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 py-1">
                        <div className="flex-1 text-[12px] font-medium text-gray-900">{i.nombre}</div>
                        <input type="number" min={1} value={i.cantidad}
                          onChange={e => setItemsCambio(prev => prev.map((item: any, j: number) =>
                            j === idx ? { ...item, cantidad: Number(e.target.value) } : item
                          ))}
                          className="w-14 text-center text-[12px] text-gray-900 bg-white border border-gray-300 rounded px-1 py-0.5 focus:outline-none" />
                        <span className="text-[11px] text-gray-500 w-16 text-right">{formatMonto(i.precio_unitario)}</span>
                        <button onClick={() => setItemsCambio(prev => prev.filter((_: any, j: number) => j !== idx))}
                          className="text-gray-300 hover:text-red-400">×</button>
                      </div>
                    ))}
                    <div className="flex justify-between text-[11px] pt-2 border-t border-blue-200 mt-1">
                      <span className="text-gray-500">Valor nuevo pedido</span>
                      <span className="font-medium text-gray-700">{formatMonto(totalCambio)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Diferencia */}
              {totalDevuelto > 0 && totalCambio > 0 && (
                <div className={`flex justify-between text-[12px] px-3 py-2.5 rounded-lg font-medium ${
                  diferenciaCambio > 0
                    ? 'bg-amber-50 border border-amber-200 text-amber-800'
                    : diferenciaCambio < 0
                      ? 'bg-teal-50 border border-teal-200 text-teal-800'
                      : 'bg-gray-50 border border-gray-200 text-gray-700'
                }`}>
                  <span>
                    {diferenciaCambio > 0 ? '↑ Cliente debe abonar'
                      : diferenciaCambio < 0 ? '↓ A devolver al cliente'
                      : '✓ Sin diferencia de importe'}
                  </span>
                  {diferenciaCambio !== 0 && (
                    <span>{formatMonto(Math.abs(diferenciaCambio))}</span>
                  )}
                </div>
              )}

              {error && <p className="text-[11px] text-red-600">{error}</p>}

              <button onClick={handleCambio}
                disabled={procesando || itemsCambio.length === 0 || totalDevuelto === 0}
                className="w-full py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {procesando ? 'Procesando...' : 'Confirmar cambio'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100">
          <button onClick={onCerrar}
            className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
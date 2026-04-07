'use client'

// src/app/dashboard/ventas/presupuestos/page.tsx

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePresupuestos } from '@/hooks/use-presupuestos'
import { formatMonto, formatFecha } from '@/lib/utils'
import type { PedidoConTotal, CanalVenta } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

function normalizar(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ── Modal nuevo cliente ────────────────────────────────────────
function ModalNuevoCliente({ onGuardar, onCancelar }: {
  onGuardar: (c: { id: number; nombre: string; telefono: string; canal: string }) => void
  onCancelar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [canal, setCanal] = useState<CanalVenta>('whatsapp')
  const [email, setEmail] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleGuardar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('clientes')
      .insert({ nombre: nombre.trim(), telefono: telefono || null, email: email || null, canal })
      .select('id, nombre, telefono, canal')
      .single()
    if (err || !data) { setError('Error al guardar'); setGuardando(false); return }
    onGuardar(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm flex flex-col gap-4">
        <h3 className="text-sm font-medium text-gray-900">Nuevo cliente</h3>
        <div className="flex flex-col gap-3">
          {[
            { label: 'Nombre *', val: nombre, set: setNombre, type: 'text', ph: 'Nombre completo o local' },
            { label: 'Teléfono', val: telefono, set: setTelefono, type: 'text', ph: '11 XXXX XXXX' },
            { label: 'Email (opcional)', val: email, set: setEmail, type: 'email', ph: 'para presupuestos' },
          ].map(f => (
            <div key={f.label} className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-400 uppercase tracking-wide">{f.label}</label>
              <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)}
                placeholder={f.ph} autoFocus={f.label.includes('Nombre')}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-400 uppercase tracking-wide">Canal</label>
            <select value={canal} onChange={e => setCanal(e.target.value as CanalVenta)}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400">
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="directo">Directo</option>
              <option value="tienda">Tienda</option>
            </select>
          </div>
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onCancelar} className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando}
            className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal confirmar presupuesto ────────────────────────────────
function ModalConfirmar({ pedido, onConfirmar, onCerrar, confirmando, error }: {
  pedido: PedidoConTotal
  onConfirmar: (d: 'confirmado' | 'en_fabricacion') => void
  onCerrar: () => void
  confirmando: boolean
  error: string | null
}) {
  const [destino, setDestino] = useState<'confirmado' | 'en_fabricacion'>('confirmado')
  const adelanto = Math.round(pedido.total_cobrado / 2)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md">
        <h3 className="text-sm font-medium text-gray-900 mb-1">Confirmar presupuesto #{pedido.id}</h3>
        <p className="text-xs text-gray-400 mb-4">{pedido.cliente_nombre ?? '(sin cliente)'} · {formatMonto(pedido.total_cobrado)}</p>
        <div className="flex flex-col gap-2 mb-4">
          {[
            { val: 'confirmado' as const, label: 'Stock disponible', hint: 'Se descuenta stock y queda listo para entregar', color: 'teal' },
            { val: 'en_fabricacion' as const, label: 'Fabricación externa', hint: `Adelanto del 50% · ${formatMonto(adelanto)}`, color: 'amber' },
          ].map(op => (
            <label key={op.val}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${destino === op.val
                ? op.color === 'teal' ? 'border-teal-500 bg-teal-50' : 'border-amber-500 bg-amber-50'
                : 'border-gray-200 hover:bg-gray-50'}`}>
              <input type="radio" name="destino" checked={destino === op.val} onChange={() => setDestino(op.val)} className="mt-0.5" />
              <div>
                <div className="text-[13px] font-medium text-gray-900">{op.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{op.hint}</div>
              </div>
            </label>
          ))}
        </div>
        {error && <div className="mb-3 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex gap-2">
          <button onClick={onCerrar} className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Cancelar</button>
          <button onClick={() => onConfirmar(destino)} disabled={confirmando}
            className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
            {confirmando ? 'Confirmando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel de detalle/edición inline ───────────────────────────
function DetallePresupuesto({ pedido, onCerrar }: {
  pedido: PedidoConTotal
  onCerrar: () => void
}) {
  const [items, setItems] = useState<any[]>([])
  const [pagos, setPagos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('items_pedido').select('*').eq('pedido_id', pedido.id),
      supabase.from('pagos_pedido').select('*').eq('pedido_id', pedido.id),
    ]).then(([itemsRes, pagosRes]) => {
      setItems(itemsRes.data ?? [])
      setPagos(pagosRes.data ?? [])
      setLoading(false)
    })
  }, [pedido.id])

  return (
    <tr>
      <td colSpan={7} className="p-0 bg-gray-50 border-t border-gray-200">
        <div className="p-4 grid grid-cols-[1fr_240px] gap-4">

          {/* Items */}
          <div>
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Productos</div>
            {loading ? (
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left pb-1.5 text-[11px] font-medium text-gray-400">Producto</th>
                    <th className="text-right pb-1.5 text-[11px] font-medium text-gray-400">Cant.</th>
                    <th className="text-right pb-1.5 text-[11px] font-medium text-gray-400">Precio unit.</th>
                    <th className="text-right pb-1.5 text-[11px] font-medium text-gray-400">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 font-medium text-gray-900">{item.nombre_producto}</td>
                      <td className="py-1.5 text-right text-gray-700">{item.cantidad}</td>
                      <td className="py-1.5 text-right text-gray-700">{formatMonto(item.precio_unitario)}</td>
                      <td className="py-1.5 text-right font-medium text-gray-900">{formatMonto(item.cantidad * item.precio_unitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {pedido.notas && (
              <div className="mt-3 text-[11px] text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
                <span className="font-medium text-gray-600">Nota: </span>{pedido.notas}
              </div>
            )}
          </div>

          {/* Totales y acciones */}
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Resumen</div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[12px]">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">{formatMonto(pedido.subtotal)}</span>
                </div>
                {pedido.descuento_pct > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-600">Descuento</span>
                    <span className="text-teal-700">— {pedido.descuento_pct}%</span>
                  </div>
                )}
                <div className="flex justify-between text-[13px] pt-1 border-t border-gray-200 mt-1">
                  <span className="font-medium text-gray-900">Total</span>
                  <span className="font-medium text-gray-900">{formatMonto(pedido.total_cobrado)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Link
                href={`/dashboard/ventas/presupuestos/${pedido.id}/editar`}
                className="w-full py-1.5 text-[11px] font-medium text-center border border-gray-200 rounded-lg text-gray-600 hover:bg-white"
              >
                Editar presupuesto
              </Link>
              <button onClick={onCerrar}
                className="w-full py-1.5 text-[11px] text-gray-400 hover:text-gray-600">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Página principal ───────────────────────────────────────────
export default function PresupuestosPage() {
  const { presupuestos, loading, error, confirmar, cancelar } = usePresupuestos()

  const [pedidoDetalle, setPedidoDetalle] = useState<number | null>(null)
  const [pedidoConfirmando, setPedidoConfirmando] = useState<PedidoConTotal | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [errorConfirm, setErrorConfirm] = useState<string | null>(null)
  const [pedidoCancelando, setPedidoCancelando] = useState<number | null>(null)
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false)

  const handleConfirmar = async (destino: 'confirmado' | 'en_fabricacion') => {
    if (!pedidoConfirmando) return
    setConfirmando(true)
    setErrorConfirm(null)
    const res = await confirmar(pedidoConfirmando.id, destino)
    if (res.ok) setPedidoConfirmando(null)
    else setErrorConfirm(res.error ?? 'Error al confirmar')
    setConfirmando(false)
  }

  const handleCancelar = async (id: number) => {
    if (!confirm('¿Cancelar este presupuesto?')) return
    setPedidoCancelando(id)
    await cancelar(id)
    setPedidoCancelando(null)
  }

  return (
    <div className="p-5 flex flex-col gap-4">

      {pedidoConfirmando && (
        <ModalConfirmar
          pedido={pedidoConfirmando}
          onConfirmar={handleConfirmar}
          onCerrar={() => { setPedidoConfirmando(null); setErrorConfirm(null) }}
          confirmando={confirmando}
          error={errorConfirm}
        />
      )}

      {modalNuevoCliente && (
        <ModalNuevoCliente
          onGuardar={() => setModalNuevoCliente(false)}
          onCancelar={() => setModalNuevoCliente(false)}
        />
      )}

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Ventas › Presupuestos</p>
          <h1 className="text-base font-medium text-gray-900">Presupuestos</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModalNuevoCliente(true)}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50">
            + Nuevo cliente
          </button>
          <Link href="/dashboard/ventas/presupuestos/nuevo"
            className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            + Nuevo presupuesto
          </Link>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Presupuestos activos', valor: presupuestos.length, fmt: false },
          { label: 'Valor total',           valor: presupuestos.reduce((s, p) => s + p.total_cobrado, 0), fmt: true },
          { label: 'Sin cliente asignado',  valor: presupuestos.filter(p => !p.cliente_id).length, fmt: false },
        ].map(m => (
          <div key={m.label} className="bg-gray-100 rounded-lg px-4 py-3">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{m.label}</div>
            <div className="text-lg font-medium text-gray-900">
              {m.fmt ? formatMonto(m.valor as number) : m.valor}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-xs text-gray-400">
          {loading ? 'Cargando...' : `${presupuestos.length} presupuestos activos · Clic en una fila para ver detalle`}
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">#</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Fecha</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Cliente</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Canal</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Entrega est.</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Total</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                    </td>
                  </tr>
                ))
              : presupuestos.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-xs text-gray-400">
                      No hay presupuestos activos
                    </td>
                  </tr>
                )
                : presupuestos.flatMap(p => [
                    <tr key={p.id}
                      onClick={() => setPedidoDetalle(prev => prev === p.id ? null : p.id)}
                      className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 ${pedidoDetalle === p.id ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-2.5 text-gray-400 text-[11px]">#{p.id}</td>
                      <td className="px-4 py-2.5 text-gray-600">{formatFecha(p.fecha_pedido)}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        {p.cliente_nombre ?? <span className="text-gray-400 font-normal italic">Sin cliente</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 capitalize">{p.canal_venta ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {p.fecha_entrega ? formatFecha(p.fecha_entrega) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                        {formatMonto(p.total_cobrado)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setPedidoConfirmando(p)}
                            className="text-[11px] px-2.5 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                            Confirmar
                          </button>
                          <button onClick={() => handleCancelar(p.id)}
                            disabled={pedidoCancelando === p.id}
                            className="text-[11px] px-2.5 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                            {pedidoCancelando === p.id ? '...' : 'Cancelar'}
                          </button>
                        </div>
                      </td>
                    </tr>,
                    pedidoDetalle === p.id && (
                      <DetallePresupuesto
                        key={`det-${p.id}`}
                        pedido={p}
                        onCerrar={() => setPedidoDetalle(null)}
                      />
                    )
                  ].filter(Boolean))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
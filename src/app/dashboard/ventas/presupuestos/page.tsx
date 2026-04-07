'use client'

// src/app/dashboard/ventas/presupuestos/page.tsx

import { useState } from 'react'
import Link from 'next/link'
import { usePresupuestos } from '@/hooks/use-presupuestos'
import { formatMonto, formatFecha } from '@/lib/utils'
import type { PedidoConTotal } from '@/lib/types'

// ── Modal de confirmación ─────────────────────────────────────

function ModalConfirmar({
  pedido,
  onConfirmar,
  onCancelar,
  confirmando,
  error,
}: {
  pedido: PedidoConTotal
  onConfirmar: (destino: 'confirmado' | 'en_fabricacion') => void
  onCancelar: () => void
  confirmando: boolean
  error: string | null
}) {
  const [destino, setDestino] = useState<'confirmado' | 'en_fabricacion'>('confirmado')
  const adelanto = Math.round(pedido.total_cobrado / 2)

  return (
    <div style={{ minHeight: 400 }} className="flex items-center justify-center bg-black/30 rounded-xl">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md mx-4">
        <h3 className="text-sm font-medium text-gray-900 mb-1">
          Confirmar presupuesto #{pedido.id}
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          {pedido.cliente_nombre ?? '(sin cliente)'} · {formatMonto(pedido.total_cobrado)}
        </p>

        <div className="flex flex-col gap-2 mb-4">
          <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50"
            style={{ borderColor: destino === 'confirmado' ? '#0F6E56' : undefined,
                     background: destino === 'confirmado' ? '#E1F5EE' : undefined }}>
            <input
              type="radio"
              name="destino"
              value="confirmado"
              checked={destino === 'confirmado'}
              onChange={() => setDestino('confirmado')}
              className="mt-0.5"
            />
            <div>
              <div className="text-[13px] font-medium text-gray-900">Stock disponible</div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                Se descuenta el stock y queda listo para entregar
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50"
            style={{ borderColor: destino === 'en_fabricacion' ? '#854F0B' : undefined,
                     background: destino === 'en_fabricacion' ? '#FAEEDA' : undefined }}>
            <input
              type="radio"
              name="destino"
              value="en_fabricacion"
              checked={destino === 'en_fabricacion'}
              onChange={() => setDestino('en_fabricacion')}
              className="mt-0.5"
            />
            <div>
              <div className="text-[13px] font-medium text-gray-900">Requiere fabricación externa</div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                Se solicita adelanto del 50% · {formatMonto(adelanto)}
              </div>
            </div>
          </label>
        </div>

        {error && (
          <div className="mb-3 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancelar}
            className="flex-1 py-2 text-xs font-medium border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(destino)}
            disabled={confirmando}
            className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {confirmando ? 'Confirmando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────

export default function PresupuestosPage() {
  const { presupuestos, loading, error, confirmar, cancelar } = usePresupuestos()

  const [pedidoConfirmando, setPedidoConfirmando] = useState<PedidoConTotal | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [errorConfirm, setErrorConfirm] = useState<string | null>(null)
  const [pedidoCancelando, setPedidoCancelando] = useState<number | null>(null)

  const handleConfirmar = async (destino: 'confirmado' | 'en_fabricacion') => {
    if (!pedidoConfirmando) return
    setConfirmando(true)
    setErrorConfirm(null)
    const resultado = await confirmar(pedidoConfirmando.id, destino)
    if (resultado.ok) {
      setPedidoConfirmando(null)
    } else {
      setErrorConfirm(resultado.error ?? 'Error al confirmar')
    }
    setConfirmando(false)
  }

  const handleCancelar = async (id: number) => {
    setPedidoCancelando(id)
    await cancelar(id)
    setPedidoCancelando(null)
  }

  return (
    <div className="p-5 flex flex-col gap-4">

      {/* Modal */}
      {pedidoConfirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md">
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              Confirmar presupuesto #{pedidoConfirmando.id}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {pedidoConfirmando.cliente_nombre ?? '(sin cliente)'} · {formatMonto(pedidoConfirmando.total_cobrado)}
            </p>

            {(() => {
              const adelanto = Math.round(pedidoConfirmando.total_cobrado / 2)
              const [destino, setDestino] = useState<'confirmado' | 'en_fabricacion'>('confirmado')
              return (
                <>
                  <div className="flex flex-col gap-2 mb-4">
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${destino === 'confirmado' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="dest" checked={destino === 'confirmado'} onChange={() => setDestino('confirmado')} className="mt-0.5" />
                      <div>
                        <div className="text-[13px] font-medium text-gray-900">Stock disponible</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">Se descuenta stock, listo para entregar</div>
                      </div>
                    </label>
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${destino === 'en_fabricacion' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="dest" checked={destino === 'en_fabricacion'} onChange={() => setDestino('en_fabricacion')} className="mt-0.5" />
                      <div>
                        <div className="text-[13px] font-medium text-gray-900">Fabricación externa</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">Adelanto del 50% · {formatMonto(adelanto)}</div>
                      </div>
                    </label>
                  </div>
                  {errorConfirm && (
                    <div className="mb-3 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {errorConfirm}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setPedidoConfirmando(null)} className="flex-1 py-2 text-xs font-medium border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
                      Cancelar
                    </button>
                    <button onClick={() => handleConfirmar(destino)} disabled={confirmando} className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                      {confirmando ? 'Confirmando...' : 'Confirmar'}
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Ventas › Presupuestos</p>
          <h1 className="text-base font-medium text-gray-900">Presupuestos</h1>
        </div>
        <Link
          href="/dashboard/ventas/presupuestos/nuevo"
          className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          + Nuevo presupuesto
        </Link>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Presupuestos activos', valor: presupuestos.length, fmt: false },
          { label: 'Valor total',           valor: presupuestos.reduce((s, p) => s + p.total_cobrado, 0), fmt: true },
          { label: 'Pendientes de respuesta', valor: presupuestos.filter(p => !p.fecha_confirmacion).length, fmt: false },
        ].map(m => (
          <div key={m.label} className="bg-gray-100 rounded-lg px-4 py-3">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{m.label}</div>
            <div className="text-lg font-medium text-gray-900">
              {m.fmt ? formatMonto(m.valor as number) : m.valor}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-xs text-gray-400">
            {loading ? 'Cargando...' : `${presupuestos.length} presupuestos activos`}
          </span>
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
                : presupuestos.map(p => (
                    <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-400 text-[11px]">#{p.id}</td>
                      <td className="px-4 py-2.5 text-gray-500">{formatFecha(p.fecha_pedido)}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        {p.cliente_nombre ?? (
                          <span className="text-gray-400 font-normal">(sin cliente)</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 capitalize">{p.canal_venta ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {p.fecha_entrega ? formatFecha(p.fecha_entrega) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                        {formatMonto(p.total_cobrado)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={() => setPedidoConfirmando(p)}
                            className="text-[11px] px-2.5 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                          >
                            Confirmar
                          </button>
                          <a href={`/api/pdf/presupuesto?id=${p.id}`} target="_blank"
                            className="text-[11px] px-2.5 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
                            PDF
                          </a>
                          <button
                            onClick={() => handleCancelar(p.id)}
                            disabled={pedidoCancelando === p.id}
                            className="text-[11px] px-2.5 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {pedidoCancelando === p.id ? '...' : 'Cancelar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
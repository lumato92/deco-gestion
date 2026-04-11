'use client'

// src/app/dashboard/compras/page.tsx

import { useState } from 'react'
import Link from 'next/link'
import { useCompras, type Compra } from '@/hooks/use-compras'
import { formatMonto, formatFecha } from '@/lib/utils'

const ESTADO_CFG = {
  borrador:         { label: 'Borrador',  cls: 'bg-gray-100 text-gray-500' },
  pendiente:        { label: 'Pendiente', cls: 'bg-amber-50 text-amber-800' },
  recibida:         { label: 'Recibida',  cls: 'bg-teal-50 text-teal-800' },
  recibida_parcial: { label: 'Parcial',   cls: 'bg-blue-50 text-blue-800' },
  cancelada:        { label: 'Cancelada', cls: 'bg-gray-100 text-gray-400' },
} as const

const PAGO_CFG = {
  pagado:    { label: 'Pagado',    cls: 'bg-teal-50 text-teal-700' },
  pendiente: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700' },
  parcial:   { label: 'Parcial',   cls: 'bg-blue-50 text-blue-700' },
} as const

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>{text}</span>
}

// ── Modal registrar pago ──────────────────────────────────────

function ModalPagar({ compra, onCompletado, onCerrar }: {
  compra: Compra
  onCompletado: () => void
  onCerrar: () => void
}) {
  const pendiente = compra.total_lineas - compra.total_pagado_real
  const [monto, setMonto] = useState(pendiente)
  const [metodo, setMetodo] = useState<'efectivo' | 'transferencia' | 'credito'>('efectivo')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const { registrarPago, recargar } = useCompras('directa')

  const handlePagar = async () => {
    if (monto <= 0) { setError('El monto debe ser mayor a 0'); return }
    setGuardando(true)
    const ok = await registrarPago(compra.id, { fecha, monto, metodo_pago: metodo, notas }, compra.total_lineas, compra.total_pagado_real)
    if (ok) { recargar(); onCompletado(); onCerrar() }
    else { setError('Error al registrar pago'); setGuardando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Registrar pago</h3>
          <p className="text-xs text-gray-400 mt-0.5">Compra #{compra.id} · {compra.proveedor_nombre ?? '(sin proveedor)'}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex justify-between text-[12px]">
          <span className="text-amber-800">Pendiente</span>
          <span className="font-medium text-amber-900">{formatMonto(pendiente)}</span>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Monto</label>
              <button onClick={() => setMonto(pendiente)} className="text-[11px] text-teal-600 hover:underline">Pagar todo</button>
            </div>
            <input type="number" min={0} value={monto || ''} onChange={e => setMonto(Number(e.target.value))}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Método</label>
            <div className="flex gap-2">
              {(['efectivo', 'transferencia', 'credito'] as const).map(m => (
                <button key={m} onClick={() => setMetodo(m)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${metodo === m ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {m === 'efectivo' ? 'Efectivo' : m === 'transferencia' ? 'Transf.' : 'Crédito'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-teal-400" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Notas (opcional)</label>
            <input type="text" value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Ej: Transferencia Galicia..."
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onCerrar} className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Cancelar</button>
          <button onClick={handlePagar} disabled={guardando}
            className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : `Registrar ${formatMonto(monto)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────

export default function ComprasPage() {
  const { compras, stats, loading, error, filtros, setFiltros, limpiarFiltros, recargar, eliminarCompra } = useCompras('directa')
  const [modalPagar, setModalPagar] = useState<Compra | null>(null)
  const [eliminando, setEliminando] = useState<number | null>(null)

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta compra?')) return
    setEliminando(id)
    await eliminarCompra(id)
    setEliminando(null)
  }

  if (error) return <div className="p-5"><div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div></div>

  return (
    <div className="p-5 flex flex-col gap-4">
      {modalPagar && <ModalPagar compra={modalPagar} onCompletado={recargar} onCerrar={() => setModalPagar(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Negocio › Compras</p>
          <h1 className="text-base font-medium text-gray-900">Compras directas</h1>
        </div>
        <Link href="/dashboard/compras/nueva"
          className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">
          + Nueva compra
        </Link>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total este mes',  valor: stats.montoMes,   fmt: true,  sub: 'en compras directas' },
          { label: 'Sin pagar',       valor: stats.sinPagar,   fmt: false, sub: 'requieren pago' },
          { label: 'Total registradas', valor: stats.total,   fmt: false, sub: 'compras directas' },
          { label: 'Pendientes',      valor: stats.pendientes, fmt: false, sub: 'sin procesar' },
        ].map(m => (
          <div key={m.label} className="bg-gray-100 rounded-lg px-4 py-3">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{m.label}</div>
            {loading ? <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
              : <div className={`text-lg font-medium ${!m.fmt && m.valor > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                  {m.fmt ? formatMonto(m.valor as number) : m.valor}
                </div>
            }
            <div className="text-[11px] text-gray-400 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar proveedor, factura, remito..."
          value={filtros.busqueda} onChange={e => setFiltros({ busqueda: e.target.value })}
          className="flex-1 min-w-[180px] text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
        <input type="date" value={filtros.desde} onChange={e => setFiltros({ desde: e.target.value })}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400" />
        <span className="text-xs text-gray-400">→</span>
        <input type="date" value={filtros.hasta} onChange={e => setFiltros({ hasta: e.target.value })}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400" />
        <select value={filtros.estado_pago} onChange={e => setFiltros({ estado_pago: e.target.value })}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400">
          <option value="">Todo pago</option>
          <option value="pagado">Pagado</option>
          <option value="pendiente">Sin pagar</option>
          <option value="parcial">Parcial</option>
        </select>
        <button onClick={limpiarFiltros} className="ml-auto text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 border border-gray-200 rounded-lg bg-white">Limpiar</button>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="text-xs text-gray-400">{loading ? 'Cargando...' : `${compras.length} compras`}</span>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">#</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Fecha</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Proveedor</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Estado</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Pago</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Total</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Pagado</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td colSpan={8} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" /></td>
              </tr>
            )) : compras.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-gray-400">No hay compras registradas</td></tr>
            ) : compras.map(c => {
              const pendiente = c.total_lineas - c.total_pagado_real
              return (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400 text-[11px]">#{c.id}</td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{formatFecha(c.fecha)}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900">{c.proveedor_nombre ?? <span className="text-gray-400 font-normal">(sin proveedor)</span>}</div>
                    {(c.numero_remito || c.numero_factura) && (
                      <div className="text-[11px] text-gray-400">
                        {c.numero_remito && `R: ${c.numero_remito}`}
                        {c.numero_remito && c.numero_factura && ' · '}
                        {c.numero_factura && `F: ${c.numero_factura}`}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5"><Badge text={ESTADO_CFG[c.estado].label} cls={ESTADO_CFG[c.estado].cls} /></td>
                  <td className="px-4 py-2.5"><Badge text={PAGO_CFG[c.estado_pago].label} cls={PAGO_CFG[c.estado_pago].cls} /></td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900">{formatMonto(c.total_lineas)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {pendiente > 0 ? (
                      <div>
                        <span className="text-gray-700">{formatMonto(c.total_pagado_real)}</span>
                        <span className="ml-1.5 text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">-{formatMonto(pendiente)}</span>
                      </div>
                    ) : <span className="text-gray-700">{formatMonto(c.total_pagado_real)}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 justify-end">
                      {c.estado_pago !== 'pagado' && (
                        <button onClick={() => setModalPagar(c)}
                          className="text-[11px] px-2.5 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium">
                          Pagar
                        </button>
                      )}
                      <button onClick={() => handleEliminar(c.id)} disabled={eliminando === c.id}
                        className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 disabled:opacity-50">
                        {eliminando === c.id ? '...' : '×'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
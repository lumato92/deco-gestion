'use client'

// src/app/dashboard/pedidos/page.tsx

import { useState } from 'react'
import Link from 'next/link'
import { useCompras, type Compra, type LineaCompra } from '@/hooks/use-compras'
import { createClient } from '@/lib/supabase/client'
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

// ── Modal recibir pedido ──────────────────────────────────────

function ModalRecibir({ compra, onCompletado, onCerrar }: {
  compra: Compra
  onCompletado: () => void
  onCerrar: () => void
}) {
  const [lineas, setLineas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [recibiendo, setRecibiendo] = useState(false)
  const [numeroRemito, setNumeroRemito] = useState('')
  const [numeroFactura, setNumeroFactura] = useState('')
  const [error, setError] = useState('')
  const { recibirCompra } = useCompras('pedido')

  useState(() => {
    createClient().from('lineas_compra').select('*').eq('compra_id', compra.id)
      .then(({ data }) => {
        setLineas(data?.map(l => ({ ...l, cant_recibir: l.cantidad_pedida - l.cantidad_recibida })) ?? [])
        setLoading(false)
      })
  })

  const esParcial = lineas.some(l => l.cant_recibir < (l.cantidad_pedida - l.cantidad_recibida))

  const handleRecibir = async () => {
    setRecibiendo(true)
    const ok = await recibirCompra(
      compra.id,
      lineas.map(l => ({ ...l, cantidad_recibida: l.cantidad_recibida + l.cant_recibir })),
      esParcial,
      { numero_remito: numeroRemito || undefined, numero_factura: numeroFactura || undefined }
    )
    if (ok) { onCompletado(); onCerrar() }
    else { setError('Error al registrar recepción'); setRecibiendo(false) }
  }

  const total = lineas.reduce((s, l) => s + l.cant_recibir * l.precio_unitario, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-900">Registrar recepción · {compra.numero_oc}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{compra.proveedor_nombre}</p>
        </div>
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-4 gap-2 text-[11px] text-gray-400 uppercase tracking-wide pb-1 border-b border-gray-100">
                  <span className="col-span-2">Artículo</span>
                  <span className="text-right">Pedido</span>
                  <span className="text-right">Recibir</span>
                </div>
                {lineas.map((l, i) => (
                  <div key={l.id} className="grid grid-cols-4 gap-2 items-center">
                    <div className="col-span-2">
                      <div className="text-[12px] font-medium text-gray-900">{l.nombre}</div>
                      <div className="text-[11px] text-gray-400">{formatMonto(l.precio_unitario)} c/u</div>
                    </div>
                    <div className="text-right text-[12px] text-gray-500">{l.cantidad_pedida} u.</div>
                    <input type="number" min={0} max={l.cantidad_pedida - l.cantidad_recibida}
                      value={l.cant_recibir}
                      onChange={e => {
                        const val = Math.min(Number(e.target.value), l.cantidad_pedida - l.cantidad_recibida)
                        setLineas(prev => prev.map((x, j) => j === i ? { ...x, cant_recibir: val } : x))
                      }}
                      className="w-full text-right text-[13px] text-gray-900 bg-white border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-teal-400" />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-gray-500 uppercase tracking-wide">N° Remito</label>
                  <input type="text" value={numeroRemito} onChange={e => setNumeroRemito(e.target.value)}
                    placeholder="Opcional"
                    className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-gray-500 uppercase tracking-wide">N° Factura</label>
                  <input type="text" value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)}
                    placeholder="Opcional"
                    className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
                </div>
              </div>

              <div className="flex justify-between text-[12px] pt-1">
                <span className="text-gray-500">Total a recibir</span>
                <span className="font-medium text-gray-900">{formatMonto(total)}</span>
              </div>

              {esParcial && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800">
                  Recepción parcial — el pedido quedará en estado "Parcial"
                </div>
              )}
            </>
          )}
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button onClick={onCerrar} className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleRecibir} disabled={recibiendo}
            className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
            {recibiendo ? 'Registrando...' : 'Confirmar recepción'}
          </button>
        </div>
      </div>
    </div>
  )
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
  const { registrarPago, recargar } = useCompras('pedido')

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
          <h3 className="text-sm font-medium text-gray-900">Registrar pago · {compra.numero_oc}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{compra.proveedor_nombre}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex justify-between text-[12px]">
          <span className="text-amber-800">Pendiente de pago</span>
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
          <div className="flex gap-2">
            {(['efectivo', 'transferencia', 'credito'] as const).map(m => (
              <button key={m} onClick={() => setMetodo(m)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${metodo === m ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {m === 'efectivo' ? 'Efectivo' : m === 'transferencia' ? 'Transf.' : 'Crédito'}
              </button>
            ))}
          </div>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-teal-400" />
          <input type="text" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas (opcional)"
            className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
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

export default function PedidosPage() {
  const { compras, stats, loading, error, filtros, setFiltros, limpiarFiltros, recargar, eliminarCompra } = useCompras('pedido')
  const [modalRecibir, setModalRecibir] = useState<Compra | null>(null)
  const [modalPagar, setModalPagar] = useState<Compra | null>(null)
  const [eliminando, setEliminando] = useState<number | null>(null)

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar este pedido?')) return
    setEliminando(id)
    await eliminarCompra(id)
    setEliminando(null)
  }

  if (error) return <div className="p-5"><div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div></div>

  return (
    <div className="p-5 flex flex-col gap-4">
      {modalRecibir && <ModalRecibir compra={modalRecibir} onCompletado={recargar} onCerrar={() => setModalRecibir(null)} />}
      {modalPagar && <ModalPagar compra={modalPagar} onCompletado={recargar} onCerrar={() => setModalPagar(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Negocio › Pedidos</p>
          <h1 className="text-base font-medium text-gray-900">Órdenes de compra</h1>
        </div>
        <Link href="/dashboard/pedidos/nuevo"
          className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">
          + Nuevo pedido
        </Link>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Pendientes de recibir', valor: stats.pendientes,  fmt: false, sub: 'esperando llegada', alerta: stats.pendientes > 0 },
          { label: 'Sin pagar',             valor: stats.sinPagar,    fmt: false, sub: 'requieren pago',    alerta: stats.sinPagar > 0 },
          { label: 'Total este mes',        valor: stats.montoMes,    fmt: true,  sub: 'en pedidos',        alerta: false },
          { label: 'Total pedidos',         valor: stats.total,       fmt: false, sub: 'registrados',       alerta: false },
        ].map(m => (
          <div key={m.label} className="bg-gray-100 rounded-lg px-4 py-3">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{m.label}</div>
            {loading ? <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
              : <div className={`text-lg font-medium ${m.alerta ? 'text-amber-700' : 'text-gray-900'}`}>
                  {m.fmt ? formatMonto(m.valor as number) : m.valor}
                </div>
            }
            <div className="text-[11px] text-gray-400 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar proveedor, OC..."
          value={filtros.busqueda} onChange={e => setFiltros({ busqueda: e.target.value })}
          className="flex-1 min-w-[180px] text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
        <input type="date" value={filtros.desde} onChange={e => setFiltros({ desde: e.target.value })}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400" />
        <span className="text-xs text-gray-400">→</span>
        <input type="date" value={filtros.hasta} onChange={e => setFiltros({ hasta: e.target.value })}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400" />
        <select value={filtros.estado} onChange={e => setFiltros({ estado: e.target.value })}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400">
          <option value="">Todo estado</option>
          <option value="pendiente">Pendiente</option>
          <option value="recibida">Recibida</option>
          <option value="recibida_parcial">Parcial</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <button onClick={limpiarFiltros} className="ml-auto text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 border border-gray-200 rounded-lg bg-white">Limpiar</button>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="text-xs text-gray-400">{loading ? 'Cargando...' : `${compras.length} pedidos`}</span>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">OC</th>
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
              <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-gray-400">No hay pedidos registrados</td></tr>
            ) : compras.map(c => {
              const pendiente = c.total_lineas - c.total_pagado_real
              const puedeRecibir = c.estado === 'pendiente' || c.estado === 'recibida_parcial'
              const puedePagar = c.estado_pago !== 'pagado' && c.estado !== 'cancelada'
              const puedeBorrar = c.estado === 'pendiente' || c.estado === 'borrador'

              return (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-purple-700 text-[12px]">{c.numero_oc ?? `#${c.id}`}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{formatFecha(c.fecha)}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{c.proveedor_nombre}</td>
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
                      {puedeRecibir && (
                        <button onClick={() => setModalRecibir(c)}
                          className="text-[11px] px-2.5 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
                          Recibir
                        </button>
                      )}
                      {puedePagar && (
                        <button onClick={() => setModalPagar(c)}
                          className="text-[11px] px-2.5 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium">
                          Pagar
                        </button>
                      )}
                      <a href={`/api/pdf/orden-compra?id=${c.id}`} target="_blank"
                        className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
                        PDF
                      </a>
                      {puedeBorrar && (
                        <Link href={`/dashboard/pedidos/${c.id}/editar`}
                          className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
                          Editar
                        </Link>
                      )}
                      {puedeBorrar && (
                        <button onClick={() => handleEliminar(c.id)} disabled={eliminando === c.id}
                          className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 disabled:opacity-50">
                          {eliminando === c.id ? '...' : '×'}
                        </button>
                      )}
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
'use client'

// src/app/dashboard/clientes/page.tsx

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useClientes, type Cliente, type PedidoCliente } from '@/hooks/use-clientes'
import { formatMonto, formatFecha } from '@/lib/utils'

const CANAL_CFG: Record<string, { label: string; cls: string }> = {
  whatsapp:  { label: 'WhatsApp',  cls: 'bg-green-50 text-green-800' },
  instagram: { label: 'Instagram', cls: 'bg-pink-50 text-pink-800' },
  directo:   { label: 'Directo',   cls: 'bg-gray-100 text-gray-600' },
  tienda:    { label: 'Tienda',    cls: 'bg-blue-50 text-blue-800' },
}

const ESTADO_CFG: Record<string, string> = {
  confirmado:     'bg-teal-50 text-teal-800',
  en_fabricacion: 'bg-amber-50 text-amber-800',
  entregado:      'bg-teal-50 text-teal-700',
  reservado:      'bg-purple-50 text-purple-800',
}

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>{text}</span>
}

function Avatar({ nombre, size = 'md' }: { nombre: string; size?: 'sm' | 'md' }) {
  const initials = nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
  const colors = ['bg-teal-100 text-teal-800', 'bg-blue-100 text-blue-800', 'bg-purple-100 text-purple-800', 'bg-pink-100 text-pink-800', 'bg-amber-100 text-amber-800']
  const color = colors[nombre.charCodeAt(0) % colors.length]
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-[11px]'
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-medium flex-shrink-0`}>
      {initials}
    </div>
  )
}

// ── Modal nuevo / editar cliente ─────────────────────────────

function ModalCliente({ cliente, onGuardar, onCerrar }: {
  cliente?: Cliente
  onGuardar: (datos: Partial<Cliente>, id?: number) => Promise<boolean>
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '')
  const [email, setEmail] = useState(cliente?.email ?? '')
  const [canal, setCanal] = useState(cliente?.canal ?? 'directo')
  const [notas, setNotas] = useState(cliente?.notas ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleGuardar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    const ok = await onGuardar({
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      canal: canal || null,
      notas: notas.trim() || null,
    } as any, cliente?.id)
    if (ok) onCerrar()
    else { setError('Error al guardar el cliente'); setGuardando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm flex flex-col gap-4">
        <h3 className="text-sm font-medium text-gray-900">
          {cliente ? 'Editar cliente' : 'Nuevo cliente'}
        </h3>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Nombre *</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Nombre completo o nombre del local" autoFocus
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Teléfono</label>
              <input type="text" value={telefono} onChange={e => setTelefono(e.target.value)}
                placeholder="11 XXXX XXXX"
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Canal</label>
              <select value={canal} onChange={e => setCanal(e.target.value)}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400">
                <option value="directo">Directo</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="tienda">Tienda</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Email (opcional)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Para presupuestos y comunicaciones"
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Notas internas</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Preferencias, datos útiles..."
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400 resize-none" />
          </div>
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onCerrar}
            className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando}
            className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel detalle inline ──────────────────────────────────────

function DetalleCliente({ cliente, onCerrar, onEditar, onNuevaVenta }: {
  cliente: Cliente
  onCerrar: () => void
  onEditar: () => void
  onNuevaVenta: () => void
}) {
  const { fetchHistorial } = useClientes()
  const [historial, setHistorial] = useState<PedidoCliente[]>([])
  const [loadingHist, setLoadingHist] = useState(true)

  useEffect(() => {
    fetchHistorial(cliente.id).then(data => {
      setHistorial(data)
      setLoadingHist(false)
    })
  }, [cliente.id])

  const ticketPromedio = cliente.cant_pedidos
    ? Math.round((cliente.total_compras ?? 0) / cliente.cant_pedidos)
    : 0

  return (
    <tr>
      <td colSpan={8} className="p-0">
        <div className="bg-gray-50 border-t border-gray-200 p-4">
          <div className="grid grid-cols-[200px_1fr_220px] gap-4">

            {/* Info del cliente */}
            <div className="flex flex-col gap-3">
              <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Datos de contacto</div>
              <div className="flex flex-col gap-1.5">
                {[
                  { lbl: 'Teléfono', val: cliente.telefono ?? '—' },
                  { lbl: 'Email',    val: cliente.email ?? '—' },
                  { lbl: 'Canal',    val: CANAL_CFG[cliente.canal ?? '']?.label ?? cliente.canal ?? '—' },
                ].map(f => (
                  <div key={f.lbl} className="flex justify-between text-[12px]">
                    <span className="text-gray-500">{f.lbl}</span>
                    <span className="font-medium text-gray-900">{f.val}</span>
                  </div>
                ))}
              </div>
              {cliente.notas && (
                <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-[11px] text-gray-600">
                  {cliente.notas}
                </div>
              )}
              <div className="flex flex-col gap-1.5 pt-1 border-t border-gray-200">
                {[
                  { lbl: 'Total compras',   val: formatMonto(cliente.total_compras ?? 0) },
                  { lbl: 'Cant. pedidos',   val: `${cliente.cant_pedidos ?? 0}` },
                  { lbl: 'Ticket prom.',    val: formatMonto(ticketPromedio) },
                  { lbl: 'Pendiente',       val: (cliente.pendiente ?? 0) > 0 ? formatMonto(cliente.pendiente ?? 0) : 'Saldado' },
                ].map(f => (
                  <div key={f.lbl} className="flex justify-between text-[12px]">
                    <span className="text-gray-500">{f.lbl}</span>
                    <span className={`font-medium ${f.lbl === 'Pendiente' && (cliente.pendiente ?? 0) > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                      {f.val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Historial de compras */}
            <div>
              <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">
                Últimas compras
              </div>
              {loadingHist ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
                  ))}
                </div>
              ) : historial.length === 0 ? (
                <div className="text-[12px] text-gray-400 py-4">Sin compras registradas</div>
              ) : (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left pb-1.5 text-[11px] font-medium text-gray-400">Fecha</th>
                      <th className="text-left pb-1.5 text-[11px] font-medium text-gray-400">Estado</th>
                      <th className="text-right pb-1.5 text-[11px] font-medium text-gray-400">Total</th>
                      <th className="text-right pb-1.5 text-[11px] font-medium text-gray-400">Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map(p => (
                      <tr key={p.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-1.5 text-gray-600">
                          {formatFecha(p.fecha_confirmacion ?? p.fecha_pedido)}
                        </td>
                        <td className="py-1.5">
                          <Badge
                            text={p.estado === 'entregado' ? 'Entregada'
                              : p.estado === 'confirmado' ? 'Confirmada'
                              : p.estado === 'en_fabricacion' ? 'Fabricación'
                              : p.estado}
                            cls={ESTADO_CFG[p.estado] ?? 'bg-gray-100 text-gray-600'}
                          />
                        </td>
                        <td className="py-1.5 text-right font-medium text-gray-900">
                          {formatMonto(p.total_cobrado)}
                        </td>
                        <td className="py-1.5 text-right">
                          {p.pendiente > 0
                            ? <span className="text-amber-700 font-medium">{formatMonto(p.pendiente)}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Acciones */}
            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Acciones</div>
              <Link href={`/dashboard/ventas/nueva?cliente_id=${cliente.id}`}
                className="w-full py-2 text-xs font-medium text-center bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                + Nueva venta
              </Link>
              <Link href={`/dashboard/ventas/presupuestos/nuevo?cliente_id=${cliente.id}`}
                className="w-full py-2 text-xs font-medium text-center border border-gray-200 rounded-lg text-gray-600 hover:bg-white">
                + Nuevo presupuesto
              </Link>
              <button onClick={onEditar}
                className="w-full py-2 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-white">
                Editar datos
              </button>
              <button onClick={onCerrar}
                className="w-full py-2 text-xs text-gray-400 hover:text-gray-600">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function ClientesPage() {
  const {
    clientes, todos, stats,
    loading, error,
    filtros, setFiltros,
    guardarCliente, eliminarCliente,
  } = useClientes()

  const [detalleAbierto, setDetalleAbierto] = useState<number | null>(null)
  const [modal, setModal] = useState<{ open: boolean; cliente?: Cliente }>({ open: false })
  const [eliminando, setEliminando] = useState<number | null>(null)

  const maxValor = Math.max(...clientes.map(c => c.total_compras ?? 0), 1)

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar este cliente? Sus compras históricas se conservan.')) return
    setEliminando(id)
    await eliminarCliente(id)
    setEliminando(null)
  }

  return (
    <div className="p-5 flex flex-col gap-4">

      {modal.open && (
        <ModalCliente
          cliente={modal.cliente}
          onGuardar={guardarCliente}
          onCerrar={() => setModal({ open: false })}
        />
      )}

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Negocio</p>
          <h1 className="text-base font-medium text-gray-900">Clientes</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal({ open: true })}
            className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            + Nuevo cliente
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total clientes',   valor: stats.total,         sub: 'registrados', fmt: false },
          { label: 'Con compras',      valor: stats.conCompras,    sub: 'compraron al menos una vez', fmt: false },
          { label: 'Ticket promedio',  valor: stats.ticketPromedio, sub: 'por pedido', fmt: true },
          { label: 'Con saldo pend.',  valor: stats.conPendiente,  sub: 'deben cobrar', fmt: false },
        ].map(m => (
          <div key={m.label} className="bg-gray-100 rounded-lg px-4 py-3">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{m.label}</div>
            {loading
              ? <div className="h-6 w-12 bg-gray-200 rounded animate-pulse" />
              : <div className="text-lg font-medium text-gray-900">
                  {m.fmt ? formatMonto(m.valor as number) : m.valor}
                </div>
            }
            <div className="text-[11px] text-gray-400 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por nombre, teléfono o email..."
          value={filtros.busqueda} onChange={e => setFiltros({ busqueda: e.target.value })}
          className="flex-1 min-w-[200px] text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
        <div className="w-px h-5 bg-gray-200" />
        <select value={filtros.canal} onChange={e => setFiltros({ canal: e.target.value })}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400">
          <option value="">Todos los canales</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="directo">Directo</option>
          <option value="tienda">Tienda</option>
        </select>
        <select value={filtros.orden} onChange={e => setFiltros({ orden: e.target.value as any })}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400">
          <option value="valor">Mayor valor total</option>
          <option value="nombre">Nombre A→Z</option>
          <option value="reciente">Última compra</option>
          <option value="cantidad">Más compras</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-xs text-gray-400">
            {loading ? 'Cargando...' : `${clientes.length} clientes · clic en una fila para ver historial`}
          </span>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400" style={{width:'30%'}}>Cliente</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Canal</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Última compra</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Compras</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Valor total</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Pendiente</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                    </td>
                  </tr>
                ))
              : clientes.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-xs text-gray-400">
                      No hay clientes con los filtros seleccionados
                    </td>
                  </tr>
                )
                : clientes.flatMap(c => {
                    const canal = CANAL_CFG[c.canal ?? '']
                    const pct = Math.round((c.total_compras ?? 0) / maxValor * 100)
                    const abierto = detalleAbierto === c.id
                    return [
                      <tr key={c.id}
                        onClick={() => setDetalleAbierto(prev => prev === c.id ? null : c.id)}
                        className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 ${abierto ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar nombre={c.nombre} />
                            <div>
                              <div className="font-medium text-gray-900">{c.nombre}</div>
                              <div className="text-[11px] text-gray-400">
                                {c.telefono}{c.email ? ` · ${c.email}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {canal
                            ? <Badge text={canal.label} cls={canal.cls} />
                            : <span className="text-gray-400">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">
                          {c.ultima_compra ? formatFecha(c.ultima_compra) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {c.cant_pedidos ?? 0}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="font-medium text-gray-900">{formatMonto(c.total_compras ?? 0)}</div>
                          <div className="w-20 h-1 bg-gray-100 rounded-full overflow-hidden mt-1 ml-auto">
                            <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {(c.pendiente ?? 0) > 0
                            ? <span className="text-amber-700 font-medium">{formatMonto(c.pendiente ?? 0)}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setModal({ open: true, cliente: c })}
                              className="text-[11px] px-2 py-1 border border-gray-200 rounded text-gray-500 hover:bg-gray-50">
                              Editar
                            </button>
                            <button onClick={() => handleEliminar(c.id)}
                              disabled={eliminando === c.id}
                              className="text-[11px] px-2 py-1 border border-gray-200 rounded text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 disabled:opacity-50">
                              {eliminando === c.id ? '...' : '×'}
                            </button>
                          </div>
                        </td>
                      </tr>,
                      abierto && (
                        <DetalleCliente
                          key={`det-${c.id}`}
                          cliente={c}
                          onCerrar={() => setDetalleAbierto(null)}
                          onEditar={() => { setModal({ open: true, cliente: c }); setDetalleAbierto(null) }}
                          onNuevaVenta={() => {}}
                        />
                      )
                    ].filter(Boolean)
                  })
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
'use client'

// src/app/dashboard/gastos/page.tsx

import { useState } from 'react'
import { useGastos, type Gasto, type GastoRecurrente } from '@/hooks/use-gastos'
import { formatMonto, formatFecha } from '@/lib/utils'

const CATEGORIAS = ['Fijo', 'Insumos', 'Flete', 'Honorarios', 'Publicidad', 'Varios'] as const

const CAT_CFG: Record<string, string> = {
  Fijo:        'bg-blue-50 text-blue-800',
  Insumos:     'bg-green-50 text-green-800',
  Flete:       'bg-amber-50 text-amber-800',
  Honorarios:  'bg-purple-50 text-purple-800',
  Publicidad:  'bg-pink-50 text-pink-800',
  Varios:      'bg-gray-100 text-gray-600',
}

const MP_CFG: Record<string, { label: string; cls: string }> = {
  efectivo:      { label: 'Efectivo',      cls: 'bg-teal-50 text-teal-800' },
  transferencia: { label: 'Transferencia', cls: 'bg-blue-50 text-blue-800' },
  debito:        { label: 'Débito',        cls: 'bg-amber-50 text-amber-800' },
  credito:       { label: 'Crédito',       cls: 'bg-pink-50 text-pink-800' },
}

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>{text}</span>
}

// ── Modal gasto (nuevo y editar) ──────────────────────────────

function ModalGasto({ gasto, onGuardar, onCerrar }: {
  gasto?: Gasto
  onGuardar: (datos: any) => Promise<boolean>
  onCerrar: () => void
}) {
  const hoy = new Date().toISOString().split('T')[0]
  const [descripcion, setDescripcion] = useState(gasto?.descripcion ?? '')
  const [categoria, setCategoria] = useState<typeof CATEGORIAS[number]>(gasto?.categoria ?? 'Varios')
  const [monto, setMonto] = useState(gasto?.monto ?? 0)
  const [fecha, setFecha] = useState(gasto?.fecha ?? hoy)
  const [metodoPago, setMetodoPago] = useState(gasto?.metodo_pago ?? 'efectivo')
  const [proveedor, setProveedor] = useState(gasto?.proveedor ?? '')
  const [comprobante, setComprobante] = useState(gasto?.comprobante ?? '')
  const [notas, setNotas] = useState(gasto?.notas ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleGuardar = async () => {
    if (!descripcion.trim()) { setError('La descripción es obligatoria'); return }
    if (monto <= 0) { setError('El monto debe ser mayor a 0'); return }
    setGuardando(true)
    const ok = await onGuardar({
      descripcion: descripcion.trim(),
      categoria, monto, fecha,
      metodo_pago: metodoPago,
      proveedor: proveedor.trim() || null,
      comprobante: comprobante.trim() || null,
      notas: notas.trim() || null,
      recurrente: gasto?.recurrente ?? false,
    })
    if (ok) onCerrar()
    else { setError('Error al guardar el gasto'); setGuardando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md flex flex-col gap-4">
        <h3 className="text-sm font-medium text-gray-900">
          {gasto ? 'Editar gasto' : 'Cargar gasto'}
        </h3>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Descripción *</label>
            <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Compra de pintura, flete, alquiler..." autoFocus
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Categoría</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value as any)}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400">
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Monto *</label>
              <input type="number" min={0} value={monto || ''} onChange={e => setMonto(Number(e.target.value))}
                placeholder="0"
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Método de pago</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(MP_CFG).map(([key, cfg]) => (
                <button key={key} type="button" onClick={() => setMetodoPago(key)}
                  className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                    metodoPago === key
                      ? 'border-teal-500 bg-teal-50 text-teal-800'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                  }`}>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-teal-400" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Proveedor</label>
              <input type="text" value={proveedor} onChange={e => setProveedor(e.target.value)}
                placeholder="Opcional"
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Comprobante</label>
              <input type="text" value={comprobante} onChange={e => setComprobante(e.target.value)}
                placeholder="Nro. factura (opcional)"
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Notas</label>
              <input type="text" value={notas} onChange={e => setNotas(e.target.value)}
                placeholder="Opcional"
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
            </div>
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
            {guardando ? 'Guardando...' : 'Guardar gasto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal recurrente (nuevo y editar) ─────────────────────────

function ModalRecurrente({ recurrente, onGuardar, onCerrar }: {
  recurrente?: GastoRecurrente
  onGuardar: (datos: Partial<GastoRecurrente>, id?: number) => Promise<boolean>
  onCerrar: () => void
}) {
  const [descripcion, setDescripcion] = useState(recurrente?.descripcion ?? '')
  const [categoria, setCategoria] = useState(recurrente?.categoria ?? 'Fijo')
  const [monto, setMonto] = useState(recurrente?.monto_estimado ?? 0)
  const [dia, setDia] = useState(recurrente?.dia_del_mes ?? 1)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleGuardar = async () => {
    if (!descripcion.trim()) { setError('La descripción es obligatoria'); return }
    if (monto <= 0) { setError('El monto debe ser mayor a 0'); return }
    setGuardando(true)
    const ok = await onGuardar({
      descripcion: descripcion.trim(),
      categoria, monto_estimado: monto,
      dia_del_mes: dia, activo: recurrente?.activo ?? true,
    }, recurrente?.id)
    if (ok) onCerrar()
    else { setError('Error al guardar'); setGuardando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm flex flex-col gap-4">
        <h3 className="text-sm font-medium text-gray-900">
          {recurrente ? 'Editar plantilla' : 'Nueva plantilla recurrente'}
        </h3>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Descripción *</label>
            <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Alquiler taller" autoFocus
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Categoría</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400">
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Monto estimado</label>
              <input type="number" min={0} value={monto || ''}
                onChange={e => setMonto(Number(e.target.value))}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Día del mes (1–28)</label>
            <input type="number" min={1} max={28} value={dia}
              onChange={e => setDia(Math.min(28, Math.max(1, Number(e.target.value))))}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
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
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)}
      style={{ width: 32, height: 18, position: 'relative', flexShrink: 0 }}
      className={`rounded-full transition-colors ${on ? 'bg-teal-500' : 'bg-gray-300'}`}>
      <div style={{
        width: 14, height: 14, top: 2,
        left: on ? 16 : 2, position: 'absolute',
      }} className="rounded-full bg-white transition-all" />
    </button>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function GastosPage() {
  const {
    gastos, todos, recurrentes,
    totalMes, porMetodo,
    loading, error,
    filtros, setFiltros, limpiarFiltros,
    crearGasto, editarGasto, eliminarGasto,
    guardarRecurrente, toggleRecurrente, eliminarRecurrente,
    generarGastosMes,
  } = useGastos()

  const [vista, setVista] = useState<'listado' | 'recurrentes'>('listado')
  const [modalGasto, setModalGasto] = useState<{ open: boolean; gasto?: Gasto }>({ open: false })
  const [modalRecurrente, setModalRecurrente] = useState<{ open: boolean; rec?: GastoRecurrente }>({ open: false })
  const [eliminando, setEliminando] = useState<number | null>(null)
  const [generando, setGenerando] = useState(false)
  const [msgGenerar, setMsgGenerar] = useState<string | null>(null)
  const [mpActivo, setMpActivo] = useState<string | null>(null)

  const maxMetodo = Math.max(...Object.values(porMetodo), 1)

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar este gasto?')) return
    setEliminando(id)
    await eliminarGasto(id)
    setEliminando(null)
  }

  const handleGenerar = async () => {
    setGenerando(true)
    setMsgGenerar(null)
    const { ok, creados } = await generarGastosMes()
    setMsgGenerar(ok
      ? creados > 0
        ? `Se generaron ${creados} gastos del mes correctamente.`
        : 'Los gastos de este mes ya estaban generados.'
      : 'Error al generar los gastos.')
    setGenerando(false)
  }

  const filtrarMetodo = (mp: string) => {
    if (mpActivo === mp) {
      setMpActivo(null)
      setFiltros({ metodo_pago: '' })
    } else {
      setMpActivo(mp)
      setFiltros({ metodo_pago: mp })
    }
  }

  return (
    <div className="p-5 flex flex-col gap-4">

      {modalGasto.open && (
        <ModalGasto
          gasto={modalGasto.gasto}
          onGuardar={async datos => {
            if (modalGasto.gasto) return editarGasto(modalGasto.gasto.id, datos)
            return crearGasto(datos)
          }}
          onCerrar={() => setModalGasto({ open: false })}
        />
      )}

      {modalRecurrente.open && (
        <ModalRecurrente
          recurrente={modalRecurrente.rec}
          onGuardar={guardarRecurrente}
          onCerrar={() => setModalRecurrente({ open: false })}
        />
      )}

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Negocio</p>
          <h1 className="text-base font-medium text-gray-900">Gastos</h1>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setVista('listado')}
              className={`px-3 py-1.5 text-xs font-medium border-r border-gray-200 ${vista === 'listado' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>
              Listado
            </button>
            <button onClick={() => setVista('recurrentes')}
              className={`px-3 py-1.5 text-xs font-medium ${vista === 'recurrentes' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>
              Recurrentes
            </button>
          </div>
          <button onClick={() => setModalGasto({ open: true })}
            className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            + Cargar gasto
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total del mes',    valor: totalMes,                      sub: `${todos.length} gastos` },
          { label: 'Salió de caja',    valor: porMetodo.efectivo + porMetodo.debito,  sub: 'efectivo + débito' },
          { label: 'Salió del banco',  valor: porMetodo.transferencia + porMetodo.credito, sub: 'transf. + crédito' },
          { label: 'Gastos fijos',     valor: todos.filter(g => g.recurrente).reduce((s, g) => s + g.monto, 0), sub: 'recurrentes del mes' },
        ].map(m => (
          <div key={m.label} className="bg-gray-100 rounded-lg px-4 py-3">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{m.label}</div>
            {loading
              ? <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
              : <div className="text-lg font-medium text-gray-900">{formatMonto(m.valor)}</div>
            }
            <div className="text-[11px] text-gray-400 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* VISTA LISTADO */}
      {vista === 'listado' && (
        <>
          {/* Cards métodos de pago */}
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(MP_CFG).map(([key, cfg]) => {
              const monto = porMetodo[key as keyof typeof porMetodo] ?? 0
              const cant = todos.filter(g => g.metodo_pago === key).length
              return (
                <button key={key} onClick={() => filtrarMetodo(key)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    mpActivo === key ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <div className="text-[11px] text-gray-500 mb-1">{cfg.label}</div>
                  <div className="text-[15px] font-medium text-gray-900">{formatMonto(monto)}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{cant} gasto{cant !== 1 ? 's' : ''}</div>
                  <div className="h-1 mt-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full"
                      style={{ width: `${Math.round(monto / maxMetodo * 100)}%` }} />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Filtros */}
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <input type="text" placeholder="Buscar descripción o proveedor..."
              value={filtros.busqueda} onChange={e => setFiltros({ busqueda: e.target.value })}
              className="flex-1 min-w-[160px] text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
            <div className="w-px h-5 bg-gray-200" />
            <input type="date" value={filtros.desde} onChange={e => setFiltros({ desde: e.target.value })}
              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400" />
            <span className="text-xs text-gray-400">→</span>
            <input type="date" value={filtros.hasta} onChange={e => setFiltros({ hasta: e.target.value })}
              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400" />
            <div className="w-px h-5 bg-gray-200" />
            <select value={filtros.categoria} onChange={e => setFiltros({ categoria: e.target.value })}
              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400">
              <option value="">Todas las categorías</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filtros.tipo} onChange={e => setFiltros({ tipo: e.target.value })}
              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400">
              <option value="">Todos</option>
              <option value="recurrente">Solo recurrentes</option>
              <option value="manual">Solo manuales</option>
            </select>
            <button onClick={() => { limpiarFiltros(); setMpActivo(null) }}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 border border-gray-200 rounded-lg">
              Limpiar
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {/* Tabla */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-xs text-gray-400">
                {loading ? 'Cargando...' : `${gastos.length} gastos · ${formatMonto(gastos.reduce((s, g) => s + g.monto, 0))}`}
              </span>
              <select className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
                <option>Más recientes primero</option>
                <option>Mayor monto</option>
              </select>
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400" style={{width:'30%'}}>Descripción</th>
                  <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Categoría</th>
                  <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Método</th>
                  <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Fecha</th>
                  <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Proveedor</th>
                  <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Monto</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                        </td>
                      </tr>
                    ))
                  : gastos.length === 0
                    ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-xs text-gray-400">
                          No hay gastos con los filtros seleccionados
                        </td>
                      </tr>
                    )
                    : gastos.map(g => {
                        const mp = MP_CFG[g.metodo_pago]
                        return (
                          <tr key={g.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-gray-900">{g.descripcion}</div>
                              {g.recurrente && (
                                <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                  Recurrente
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge text={g.categoria} cls={CAT_CFG[g.categoria] ?? 'bg-gray-100 text-gray-600'} />
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge text={mp?.label ?? g.metodo_pago} cls={mp?.cls ?? 'bg-gray-100 text-gray-600'} />
                            </td>
                            <td className="px-4 py-2.5 text-gray-500">{g.fecha}</td>
                            <td className="px-4 py-2.5 text-gray-500">{g.proveedor ?? '—'}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                              {formatMonto(g.monto)}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex gap-1 justify-end">
                                <button onClick={() => setModalGasto({ open: true, gasto: g })}
                                  className="text-[11px] px-2 py-1 border border-gray-200 rounded text-gray-500 hover:bg-gray-50">
                                  Editar
                                </button>
                                <button onClick={() => handleEliminar(g.id)}
                                  disabled={eliminando === g.id}
                                  className="text-[11px] px-2 py-1 border border-gray-200 rounded text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 disabled:opacity-50">
                                  {eliminando === g.id ? '...' : '×'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                }
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* VISTA RECURRENTES */}
      {vista === 'recurrentes' && (
        <div className="flex flex-col gap-4">

          {/* Banner generar */}
          <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-teal-900">Generar gastos del mes</div>
              <div className="text-[11px] text-teal-700 mt-0.5">
                Crea automáticamente los gastos fijos basados en las plantillas activas
              </div>
              {msgGenerar && (
                <div className="text-[11px] text-teal-800 mt-1 font-medium">{msgGenerar}</div>
              )}
            </div>
            <button onClick={handleGenerar} disabled={generando}
              className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex-shrink-0">
              {generando ? 'Generando...' : 'Generar ahora'}
            </button>
          </div>

          {/* Lista recurrentes */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-[13px] font-medium text-gray-900">Plantillas de gastos fijos</span>
              <button onClick={() => setModalRecurrente({ open: true })}
                className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                + Nueva plantilla
              </button>
            </div>

            {recurrentes.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-400">
                No hay plantillas de gastos recurrentes
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recurrentes.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-[13px] font-medium text-gray-900">{r.descripcion}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge text={r.categoria} cls={CAT_CFG[r.categoria] ?? 'bg-gray-100 text-gray-600'} />
                        <span className="text-[11px] text-gray-400">· Día {r.dia_del_mes} de cada mes</span>
                      </div>
                    </div>
                    <div className="text-[14px] font-medium text-gray-900 mr-3">
                      {formatMonto(r.monto_estimado)}
                    </div>
                    <Toggle on={r.activo} onChange={v => toggleRecurrente(r.id, v)} />
                    <button onClick={() => setModalRecurrente({ open: true, rec: r })}
                      className="text-[11px] px-2 py-1 border border-gray-200 rounded text-gray-500 hover:bg-gray-50 ml-1">
                      Editar
                    </button>
                    <button onClick={async () => {
                      if (!confirm('¿Eliminar esta plantilla?')) return
                      await eliminarRecurrente(r.id)
                    }} className="text-[11px] px-2 py-1 border border-gray-200 rounded text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">
                {recurrentes.filter(r => r.activo).length} de {recurrentes.length} plantillas activas
              </span>
              <span className="text-[12px] font-medium text-gray-700">
                Total mensual: {formatMonto(recurrentes.filter(r => r.activo).reduce((s, r) => s + r.monto_estimado, 0))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
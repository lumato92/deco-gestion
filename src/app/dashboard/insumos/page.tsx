'use client'

// src/app/dashboard/insumos/page.tsx

import { useState, useEffect } from 'react'
import { useInsumos, type Insumo } from '@/hooks/use-insumos'
import { formatMonto } from '@/lib/utils'

function normalizar(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const STOCK_CFG = {
  ok:    { label: 'OK',    cls: 'bg-teal-50 text-teal-800',   dot: 'bg-teal-400' },
  medio: { label: 'Medio', cls: 'bg-amber-50 text-amber-800', dot: 'bg-amber-400' },
  bajo:  { label: 'Bajo',  cls: 'bg-red-50 text-red-800',     dot: 'bg-red-400' },
} as const

// ── Input de categoría con autocomplete ───────────────────────

function InputCategoria({ value, onChange, categorias }: {
  value: string
  onChange: (v: string) => void
  categorias: string[]
}) {
  const [abierto, setAbierto] = useState(false)

  const sugerencias = value.length >= 1
    ? categorias.filter(c =>
        normalizar(c).includes(normalizar(value)) && normalizar(c) !== normalizar(value)
      )
    : []

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        placeholder="Ej: Textil, Pintura, Madera"
        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400"
      />
      {abierto && sugerencias.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg z-20 overflow-hidden shadow-sm">
          {sugerencias.map(c => (
            <button
              key={c}
              onMouseDown={() => { onChange(c); setAbierto(false) }}
              className="w-full text-left px-3 py-2 text-[12px] text-gray-900 hover:bg-gray-50 border-b border-gray-100 last:border-0"
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Modal nuevo / editar insumo ───────────────────────────────

function ModalInsumo({ insumo, categorias, onGuardar, onCerrar }: {
  insumo?: Insumo
  categorias: string[]
  onGuardar: (datos: Partial<Insumo>, id?: number) => Promise<boolean>
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState(insumo?.nombre ?? '')
  const [categoria, setCategoria] = useState(insumo?.categoria ?? '')
  const [unidad, setUnidad] = useState(insumo?.unidad ?? 'unidades')
  const [stock, setStock] = useState(insumo?.stock ?? 0)
  const [costo, setCosto] = useState(insumo?.costo ?? 0)
  const [minimo, setMinimo] = useState(insumo?.minimo ?? 0)
  const [proveedor, setProveedor] = useState(insumo?.proveedor ?? '')
  const [esFabricable, setEsFabricable] = useState(insumo?.es_fabricable ?? false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleGuardar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!categoria.trim()) { setError('La categoría es obligatoria'); return }
    setGuardando(true)
    const ok = await onGuardar({
      nombre: nombre.trim(),
      categoria: categoria.trim(),
      unidad,
      stock,
      costo,
      minimo,
      proveedor: proveedor.trim() || undefined,
      es_fabricable: esFabricable,
    }, insumo?.id)
    if (ok) onCerrar()
    else { setError('Error al guardar el insumo'); setGuardando(false) }
  }

  const unidades = ['unidades', 'kg', 'gramos', 'litros', 'ml', 'metros', 'cm', 'hojas', 'rollos']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md flex flex-col gap-4">
        <h3 className="text-sm font-medium text-gray-900">
          {insumo ? 'Editar insumo' : 'Nuevo insumo'}
        </h3>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Nombre *</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Hilo macramé natural" autoFocus
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">
              Categoría * — elegí una existente o escribí una nueva
            </label>
            <InputCategoria
              value={categoria}
              onChange={setCategoria}
              categorias={categorias}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Unidad</label>
              <select value={unidad} onChange={e => setUnidad(e.target.value)}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400">
                {unidades.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Costo unitario</label>
              <input type="number" min={0} value={costo} onChange={e => setCosto(Number(e.target.value))}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Stock mínimo</label>
              <input type="number" min={0} value={minimo} onChange={e => setMinimo(Number(e.target.value))}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
            </div>
            {!insumo && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Stock inicial</label>
                <input type="number" min={0} value={stock} onChange={e => setStock(Number(e.target.value))}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Proveedor (opcional)</label>
            <input type="text" value={proveedor} onChange={e => setProveedor(e.target.value)}
              placeholder="Nombre del proveedor"
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={esFabricable}
              onChange={e => setEsFabricable(e.target.checked)} className="rounded" />
            <span className="text-[12px] text-gray-700">
              Es fabricable (tiene receta de producción propia)
            </span>
          </label>
        </div>

        {error && <p className="text-[11px] text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onCerrar}
            className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando}
            className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar insumo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel de ajuste de stock inline ──────────────────────────

function PanelAjuste({ insumo, onAjustar, onCerrar }: {
  insumo: Insumo
  onAjustar: (op: 'entrada' | 'salida' | 'ajuste', cant: number, costo?: number) => Promise<boolean>
  onCerrar: () => void
}) {
  const [operacion, setOperacion] = useState<'entrada' | 'salida' | 'ajuste'>('entrada')
  const [cantidad, setCantidad] = useState(1)
  const [nuevoCosto, setNuevoCosto] = useState(insumo.costo)
  const [ajustando, setAjustando] = useState(false)
  const [error, setError] = useState('')

  const stockResultante = operacion === 'entrada'
    ? insumo.stock + cantidad
    : operacion === 'salida'
      ? Math.max(0, insumo.stock - cantidad)
      : cantidad

  const handleAjustar = async () => {
    if (cantidad <= 0 && operacion !== 'ajuste') { setError('La cantidad debe ser mayor a 0'); return }
    setAjustando(true)
    const ok = await onAjustar(operacion, cantidad, operacion === 'entrada' ? nuevoCosto : undefined)
    if (ok) onCerrar()
    else { setError('Error al ajustar'); setAjustando(false) }
  }

  return (
    <tr>
      <td colSpan={7} className="p-0">
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Operación</label>
              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                {([
                  { val: 'entrada', label: 'Entrada (compra)' },
                  { val: 'salida',  label: 'Salida (descarte)' },
                  { val: 'ajuste',  label: 'Ajuste manual' },
                ] as const).map(op => (
                  <button key={op.val} onClick={() => setOperacion(op.val)}
                    className={`px-3 py-1.5 text-xs font-medium border-r border-gray-200 last:border-0 transition-colors ${operacion === op.val ? 'bg-white text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">
                {operacion === 'ajuste' ? 'Nuevo stock total' : 'Cantidad'}
              </label>
              <div className="flex items-center gap-2">
                <input type="number" min={0} step={0.01} value={cantidad}
                  onChange={e => setCantidad(Number(e.target.value))}
                  className="w-24 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-400" />
                <span className="text-[11px] text-gray-500">{insumo.unidad}</span>
              </div>
            </div>

            {operacion === 'entrada' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">
                  Costo unit. (actualiza el precio)
                </label>
                <input type="number" min={0} value={nuevoCosto}
                  onChange={e => setNuevoCosto(Number(e.target.value))}
                  className="w-32 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-400" />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Stock resultante</label>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-gray-400 line-through">{insumo.stock} {insumo.unidad}</span>
                <span className="text-gray-400">→</span>
                <span className={`font-medium ${stockResultante <= insumo.minimo ? 'text-red-600' : 'text-teal-700'}`}>
                  {Math.round(stockResultante * 100) / 100} {insumo.unidad}
                </span>
              </div>
            </div>

            <div className="flex gap-2 ml-auto items-end">
              {error && <span className="text-[11px] text-red-600">{error}</span>}
              <button onClick={onCerrar}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100">
                Cancelar
              </button>
              <button onClick={handleAjustar} disabled={ajustando}
                className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                {ajustando ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function InsumosPage() {
  const {
    insumos, todos, stats, categorias,
    loading, error, filtros, setFiltros, limpiarFiltros,
    ajustarStock, guardarInsumo, eliminarInsumo,
  } = useInsumos()

  const [tabActivo, setTabActivo] = useState<'todos' | 'bajo' | 'sinstock' | 'fabricable'>('todos')
  const [ajusteAbierto, setAjusteAbierto] = useState<number | null>(null)
  const [modalInsumo, setModalInsumo] = useState<{ open: boolean; insumo?: Insumo }>({ open: false })
  const [eliminando, setEliminando] = useState<number | null>(null)

  const insumosFiltrados = insumos.filter(i => {
    if (tabActivo === 'bajo') return i.estado_stock === 'bajo' && i.stock > 0
    if (tabActivo === 'sinstock') return i.stock === 0
    if (tabActivo === 'fabricable') return i.es_fabricable
    return true
  })

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar este insumo? Esta acción no se puede deshacer.')) return
    setEliminando(id)
    await eliminarInsumo(id)
    setEliminando(null)
  }

  return (
    <div className="p-5 flex flex-col gap-4">

      {modalInsumo.open && (
        <ModalInsumo
          insumo={modalInsumo.insumo}
          categorias={categorias}
          onGuardar={guardarInsumo}
          onCerrar={() => setModalInsumo({ open: false })}
        />
      )}

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Catálogo</p>
          <h1 className="text-base font-medium text-gray-900">Insumos</h1>
        </div>
        <button onClick={() => setModalInsumo({ open: true })}
          className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">
          + Nuevo insumo
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total insumos',  valor: stats.total,      fmt: false, sub: `${categorias.length} categorías`, alerta: false },
          { label: 'Valor en stock', valor: stats.valorTotal, fmt: true,  sub: 'al costo actual', alerta: false },
          { label: 'Stock bajo',     valor: stats.stockBajo,  fmt: false, sub: 'requieren reposición', alerta: stats.stockBajo > 0 },
          { label: 'Sin stock',      valor: stats.sinStock,   fmt: false, sub: 'bloquean fabricación', alerta: stats.sinStock > 0 },
        ].map(m => (
          <div key={m.label} className="bg-gray-100 rounded-lg px-4 py-3">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{m.label}</div>
            {loading
              ? <div className="h-6 w-12 bg-gray-200 rounded animate-pulse" />
              : <div className={`text-lg font-medium ${m.alerta ? 'text-red-600' : 'text-gray-900'}`}>
                  {m.fmt ? formatMonto(m.valor as number) : m.valor}
                </div>
            }
            <div className="text-[11px] text-gray-400 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'todos',      label: `Todos (${todos.length})` },
          { key: 'bajo',       label: `Stock bajo (${stats.stockBajo})` },
          { key: 'sinstock',   label: `Sin stock (${stats.sinStock})` },
          { key: 'fabricable', label: `Fabricables (${todos.filter(i => i.es_fabricable).length})` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setTabActivo(tab.key as any)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              tabActivo === tab.key
                ? (tab.key === 'bajo' || tab.key === 'sinstock')
                  ? 'bg-red-50 border-red-400 text-red-700'
                  : 'bg-teal-50 border-teal-500 text-teal-800'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filtros — con categorías dinámicas */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por nombre, categoría o proveedor..."
          value={filtros.busqueda} onChange={e => setFiltros({ busqueda: e.target.value })}
          className="flex-1 min-w-[180px] text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
        <div className="w-px h-5 bg-gray-200" />
        <select value={filtros.categoria} onChange={e => setFiltros({ categoria: e.target.value })}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400">
          <option value="">Todas las categorías</option>
          {/* Categorías reales cargadas desde los insumos */}
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtros.estado_stock} onChange={e => setFiltros({ estado_stock: e.target.value })}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400">
          <option value="">Todo stock</option>
          <option value="bajo">Bajo</option>
          <option value="medio">Medio</option>
          <option value="ok">OK</option>
        </select>
        <button onClick={limpiarFiltros}
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
            {loading ? 'Cargando...' : `${insumosFiltrados.length} insumos`}
          </span>
          <select className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
            <option>Nombre A→Z</option>
            <option>Menor stock primero</option>
            <option>Mayor valor en stock</option>
          </select>
        </div>

        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400" style={{width:'28%'}}>Insumo</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Categoría</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Stock</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Costo unit.</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Valor stock</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Proveedor</th>
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
              : insumosFiltrados.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-xs text-gray-400">
                      No hay insumos con los filtros seleccionados
                    </td>
                  </tr>
                )
                : insumosFiltrados.flatMap(ins => {
                    const stock = STOCK_CFG[ins.estado_stock]
                    const pct = ins.minimo > 0
                      ? Math.min(ins.stock / (ins.minimo * 2) * 100, 100)
                      : 80
                    return [
                      <tr key={ins.id}
                        className={`border-t border-gray-100 hover:bg-gray-50 ${ajusteAbierto === ins.id ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900">{ins.nombre}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {ins.es_fabricable && (
                              <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                                Fabricable
                              </span>
                            )}
                            <span className="text-[11px] text-gray-400">{ins.unidad}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{ins.categoria}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${stock.dot}`} />
                            <div>
                              <div className="text-gray-900 font-medium">
                                {ins.stock} <span className="font-normal text-gray-400">{ins.unidad}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${
                                    ins.estado_stock === 'ok' ? 'bg-teal-500'
                                    : ins.estado_stock === 'medio' ? 'bg-amber-500' : 'bg-red-500'
                                  }`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[10px] text-gray-400">mín {ins.minimo}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{formatMonto(ins.costo)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                          {formatMonto(ins.valor_stock)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-gray-600">{ins.proveedor_nombre ?? ins.proveedor ?? '—'}</div>
                          {ins.proveedor_canal && (
                            <div className="text-[11px] text-gray-400">{ins.proveedor_canal}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => setAjusteAbierto(prev => prev === ins.id ? null : ins.id)}
                              className="text-[11px] px-2.5 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                              + Stock
                            </button>
                            <button
                              onClick={() => setModalInsumo({ open: true, insumo: ins })}
                              className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
                              Editar
                            </button>
                            <button
                              onClick={() => handleEliminar(ins.id)}
                              disabled={eliminando === ins.id}
                              className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 disabled:opacity-50">
                              {eliminando === ins.id ? '...' : '×'}
                            </button>
                          </div>
                        </td>
                      </tr>,
                      ajusteAbierto === ins.id && (
                        <PanelAjuste
                          key={`ajuste-${ins.id}`}
                          insumo={ins}
                          onAjustar={(op, cant, costo) => ajustarStock(ins.id, op, cant, costo)}
                          onCerrar={() => setAjusteAbierto(null)}
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
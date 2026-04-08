'use client'

// src/app/dashboard/productos/page.tsx

import Link from 'next/link'
import { useProductos, type Producto } from '@/hooks/use-productos'
import { createClient } from '@/lib/supabase/client'
import { formatMonto } from '@/lib/utils'
import { useState, useEffect } from 'react'

function normalizar(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const TIPO_CFG = {
  propio:       { label: 'Propio',       cls: 'bg-purple-50 text-purple-800' },
  reventa:      { label: 'Reventa',      cls: 'bg-blue-50 text-blue-800' },
  consignacion: { label: 'Consignación', cls: 'bg-amber-50 text-amber-800' },
} as const

const STOCK_CFG = {
  ok:    { label: 'OK',    cls: 'bg-teal-50 text-teal-800',   dot: 'bg-teal-500' },
  medio: { label: 'Medio', cls: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  bajo:  { label: 'Bajo',  cls: 'bg-red-50 text-red-800',     dot: 'bg-red-500' },
} as const

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>{text}</span>
}

function MargenColor({ pct }: { pct: number }) {
  const cls = pct >= 40 ? 'text-teal-700' : pct >= 20 ? 'text-amber-700' : 'text-red-600'
  return <span className={`font-medium ${cls}`}>{pct}%</span>
}

// ── Panel de ajuste de stock inline ──────────────────────────

function PanelAjuste({ producto, onAjustar, onCerrar }: {
  producto: Producto
  onAjustar: (op: 'entrada' | 'salida' | 'ajuste', cant: number, costo?: number) => Promise<boolean>
  onCerrar: () => void
}) {
  const [operacion, setOperacion] = useState<'entrada' | 'salida' | 'ajuste'>('entrada')
  const [cantidad, setCantidad] = useState(1)
  const [nuevoCosto, setNuevoCosto] = useState(producto.costo)
  const [ajustando, setAjustando] = useState(false)
  const [error, setError] = useState('')

  const stockResultante = operacion === 'entrada'
    ? producto.stock + cantidad
    : operacion === 'salida'
      ? Math.max(0, producto.stock - cantidad)
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
                    className={`px-3 py-1.5 text-xs font-medium border-r border-gray-200 last:border-0 transition-colors ${
                      operacion === op.val ? 'bg-white text-gray-900' : 'text-gray-500 hover:bg-gray-100'
                    }`}>
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
                <input
                  type="number" min={0} step={1} value={cantidad}
                  onChange={e => setCantidad(Number(e.target.value))}
                  className="w-24 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-400"
                />
                <span className="text-[11px] text-gray-500">u.</span>
              </div>
            </div>

            {operacion === 'entrada' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">
                  Costo unit. (actualiza el precio)
                </label>
                <input
                  type="number" min={0} value={nuevoCosto}
                  onChange={e => setNuevoCosto(Number(e.target.value))}
                  className="w-32 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-400"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Stock resultante</label>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-gray-400 line-through">{producto.stock} u.</span>
                <span className="text-gray-400">→</span>
                <span className={`font-medium ${stockResultante <= producto.minimo ? 'text-red-600' : 'text-teal-700'}`}>
                  {stockResultante} u.
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

// ── Modal fabricar ────────────────────────────────────────────

function ModalFabricar({ producto, onCompletado, onCerrar }: {
  producto: { id: number; nombre: string; stock: number }
  onCompletado: () => void
  onCerrar: () => void
}) {
  const [cantidad, setCantidad] = useState(1)
  const [fabricando, setFabricando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [erroresInsumos, setErroresInsumos] = useState<any[]>([])
  const [receta, setReceta] = useState<any[]>([])
  const [loadingReceta, setLoadingReceta] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const cargar = async () => {
      const { data: recetaData } = await supabase
        .from('recetas')
        .select(`cantidad, insumos (id, nombre, unidad, stock, costo)`)
        .eq('producto_id', producto.id)
      if (recetaData) {
        setReceta(recetaData.map((r: any) => ({
          insumo_id: r.insumos.id,
          insumo_nombre: r.insumos.nombre,
          cantidad_unit: r.cantidad,
          unidad: r.insumos.unidad,
          stock_disponible: r.insumos.stock,
          costo_unit: r.insumos.costo,
        })))
      }
      setLoadingReceta(false)
    }
    cargar()
  }, [producto.id])

  const insuficientes = receta.filter(r => r.stock_disponible < r.cantidad_unit * cantidad)

  const handleFabricar = async () => {
    if (cantidad <= 0) { setError('La cantidad debe ser mayor a 0'); return }
    setFabricando(true)
    setError(null)
    setErroresInsumos([])
    const supabase = createClient()
    const { data, error: err } = await supabase.rpc('fabricar', {
      p_producto_id: producto.id,
      p_cantidad: cantidad,
    })
    if (err) { setError(err.message); setFabricando(false); return }
    if (!data?.ok) { setErroresInsumos(data?.errores ?? []); setFabricando(false); return }
    onCompletado()
    onCerrar()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-900">Fabricar producto</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {producto.nombre} · Stock actual: {producto.stock} u.
          </p>
        </div>

        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Cantidad a fabricar</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setCantidad(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center text-lg font-medium">−</button>
              <input type="number" min={1} value={cantidad}
                onChange={e => setCantidad(Math.max(1, Number(e.target.value)))}
                className="w-20 text-center text-[16px] font-medium text-gray-900 bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-teal-400" />
              <button onClick={() => setCantidad(q => q + 1)}
                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center text-lg font-medium">+</button>
              <span className="text-[12px] text-gray-400">unidades</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">
              Insumos necesarios para {cantidad} u.
            </div>
            {loadingReceta ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : receta.length === 0 ? (
              <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                ⚠️ Este producto no tiene receta cargada.
              </div>
            ) : (
              <div className="flex flex-col gap-1 bg-gray-50 rounded-xl p-3">
                {receta.map(r => {
                  const necesario = r.cantidad_unit * cantidad
                  const suficiente = r.stock_disponible >= necesario
                  const falta = necesario - r.stock_disponible
                  return (
                    <div key={r.insumo_id} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                      <div className="flex-1">
                        <div className="text-[12px] font-medium text-gray-900">{r.insumo_nombre}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Necesita <span className="font-medium text-gray-700">{necesario} {r.unidad}</span>
                          {' '}· Stock: <span className={`font-medium ${suficiente ? 'text-teal-700' : 'text-red-600'}`}>
                            {r.stock_disponible} {r.unidad}
                          </span>
                        </div>
                      </div>
                      <div className={`text-[11px] font-medium px-2 py-0.5 rounded-full ml-3 flex-shrink-0 ${
                        suficiente ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {suficiente ? '✓ OK' : `Faltan ${falta % 1 === 0 ? falta : falta.toFixed(2)}`}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {erroresInsumos.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="text-[12px] font-medium text-red-800 mb-2">Stock insuficiente:</div>
              {erroresInsumos.map((e: any, i: number) => (
                <div key={i} className="text-[11px] text-red-700 py-1.5 border-b border-red-100 last:border-0">
                  <span className="font-medium">{e.insumo}</span> — necesita {e.necesario}, tiene {e.disponible}
                  {e.es_fabricable && <div className="text-red-500 mt-0.5">💡 Fabricable — fabricalo primero desde Insumos</div>}
                </div>
              ))}
            </div>
          )}

          {insuficientes.length > 0 && erroresInsumos.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-[11px] text-amber-800">
              ⚠️ Stock insuficiente para {cantidad} unidades.
            </div>
          )}

          {error && (
            <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button onClick={onCerrar}
            className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleFabricar}
            disabled={fabricando || receta.length === 0 || insuficientes.length > 0}
            className="flex-1 py-2 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {fabricando ? 'Fabricando...' : `Fabricar ${cantidad} u.`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────

export default function ProductosPage() {
  const {
    productos, todos, stats, loading, error,
    filtros, setFiltros, limpiarFiltros, recargar,
    ajustarStock,
  } = useProductos()

  const [vista, setVista] = useState<'lista' | 'grilla'>('lista')
  const [modalFabricar, setModalFabricar] = useState<{ id: number; nombre: string; stock: number } | null>(null)
  const [ajusteAbierto, setAjusteAbierto] = useState<number | null>(null)

  const categorias = Array.from(
    new Map(todos.filter(p => p.categoria_id && p.categoria_nombre)
      .map(p => [p.categoria_id, { id: p.categoria_id!, nombre: p.categoria_nombre! }]))
      .values()
  )

  if (error) return (
    <div className="p-5">
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
    </div>
  )

  return (
    <div className="p-5 flex flex-col gap-4">

      {modalFabricar && (
        <ModalFabricar
          producto={modalFabricar}
          onCompletado={() => { recargar(); setModalFabricar(null) }}
          onCerrar={() => setModalFabricar(null)}
        />
      )}

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Catálogo</p>
          <h1 className="text-base font-medium text-gray-900">Productos</h1>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setVista('lista')}
              className={`px-2.5 py-1.5 ${vista === 'lista' ? 'bg-gray-100' : 'hover:bg-gray-50'}`} title="Vista lista">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4h12M2 8h12M2 12h12"/>
              </svg>
            </button>
            <button onClick={() => setVista('grilla')}
              className={`px-2.5 py-1.5 border-l border-gray-200 ${vista === 'grilla' ? 'bg-gray-100' : 'hover:bg-gray-50'}`} title="Vista grilla">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
                <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
              </svg>
            </button>
          </div>
          <Link href="/dashboard/productos/nuevo"
            className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            + Nuevo producto
          </Link>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total productos', valor: stats.total,       sub: 'en catálogo',           fmt: false },
          { label: 'Valor en stock',  valor: stats.valorStock,  sub: 'al costo',               fmt: true },
          { label: 'Stock bajo',      valor: stats.stockBajo,   sub: 'requieren reposición',   fmt: false },
          { label: 'Sin publicar',    valor: stats.sinPublicar, sub: 'no visibles en tienda',  fmt: false },
        ].map(m => (
          <div key={m.label} className="bg-gray-100 rounded-lg px-4 py-3">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{m.label}</div>
            {loading
              ? <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
              : <div className="text-lg font-medium text-gray-900">
                  {m.fmt ? formatMonto(m.valor as number) : m.valor}
                </div>
            }
            <div className="text-[11px] text-gray-400 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs categoría */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFiltros({ categoria_id: '' })}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            filtros.categoria_id === '' ? 'bg-teal-50 border-teal-500 text-teal-800' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
          }`}>
          Todos ({todos.length})
        </button>
        {categorias.map(c => {
          const cnt = todos.filter(p => p.categoria_id === c.id).length
          return (
            <button key={c.id} onClick={() => setFiltros({ categoria_id: c.id })}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                filtros.categoria_id === c.id ? 'bg-teal-50 border-teal-500 text-teal-800' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              {c.nombre} ({cnt})
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por nombre..."
          value={filtros.busqueda} onChange={e => setFiltros({ busqueda: e.target.value })}
          className="flex-1 min-w-[160px] text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
        <div className="w-px h-5 bg-gray-200" />
        {[
          { key: 'tipo',         opts: [['', 'Todo tipo'], ['propio', 'Propio'], ['reventa', 'Reventa'], ['consignacion', 'Consignación']] },
          { key: 'estado_stock', opts: [['', 'Todo stock'], ['bajo', 'Bajo'], ['medio', 'Medio'], ['ok', 'OK']] },
          { key: 'publicado',    opts: [['', 'Todos'], ['true', 'Publicados'], ['false', 'No publicados']] },
        ].map(f => (
          <select key={f.key} value={(filtros as any)[f.key]}
            onChange={e => setFiltros({ [f.key]: e.target.value } as any)}
            className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400">
            {f.opts.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
          </select>
        ))}
        <button onClick={limpiarFiltros}
          className="ml-auto text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 border border-gray-200 rounded-lg bg-white">
          Limpiar
        </button>
      </div>

      {/* VISTA LISTA */}
      {vista === 'lista' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-xs text-gray-400">
              {loading ? 'Cargando...' : `${productos.length} productos`}
            </span>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400" style={{width:'35%'}}>Producto</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Tipo</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Stock</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Costo</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Precio</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Margen</th>
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
                : productos.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-xs text-gray-400">
                        No hay productos con los filtros seleccionados
                      </td>
                    </tr>
                  )
                  : productos.flatMap(p => {
                      const tipo = TIPO_CFG[p.tipo]
                      const stock = p.estado_stock ? STOCK_CFG[p.estado_stock] : null
                      return [
                        <tr key={p.id}
                          className={`border-t border-gray-100 hover:bg-gray-50 ${ajusteAbierto === p.id ? 'bg-blue-50' : ''}`}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                                {p.imagen_principal
                                  ? <img src={p.imagen_principal} alt={p.nombre} className="w-full h-full object-cover" />
                                  : <div className="w-full h-full bg-gray-100" />
                                }
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {p.nombre}
                                  {p.destacado && <span className="ml-1 text-amber-500 text-[10px]">★</span>}
                                  {!p.publicado && <span className="ml-1 text-[10px] text-gray-400">· no publicado</span>}
                                </div>
                                <div className="text-[11px] text-gray-400">
                                  {p.categoria_nombre}{p.subcategoria_nombre ? ` · ${p.subcategoria_nombre}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge text={tipo.label} cls={tipo.cls} />
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {stock && <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${stock.dot}`} />}
                              <div>
                                <div className="text-gray-900">{p.stock} u.</div>
                                {stock && <Badge text={stock.label} cls={stock.cls} />}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{formatMonto(p.costo)}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900">{formatMonto(p.precio)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <MargenColor pct={p.margen_pct ?? 0} />
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => setAjusteAbierto(prev => prev === p.id ? null : p.id)}
                                className="text-[11px] px-2.5 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
                                + Stock
                              </button>
                              {p.tipo === 'propio' && (
                                <button
                                  onClick={() => setModalFabricar({ id: p.id, nombre: p.nombre, stock: p.stock })}
                                  className="text-[11px] px-2.5 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                                  Fabricar
                                </button>
                              )}
                              <Link href={`/dashboard/productos/${p.id}/editar`}
                                className="text-[11px] border border-gray-200 rounded px-2 py-1 text-gray-500 hover:bg-gray-50">
                                Editar
                              </Link>
                            </div>
                          </td>
                        </tr>,
                        ajusteAbierto === p.id && (
                          <PanelAjuste
                            key={`ajuste-${p.id}`}
                            producto={p}
                            onAjustar={(op, cant, costo) => ajustarStock(p.id, op, cant, costo)}
                            onCerrar={() => setAjusteAbierto(null)}
                          />
                        )
                      ].filter(Boolean)
                    })
              }
            </tbody>
          </table>
        </div>
      )}

      {/* VISTA GRILLA */}
      {vista === 'grilla' && (
        <div className="grid grid-cols-3 gap-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="h-28 bg-gray-100 animate-pulse" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))
            : productos.map(p => {
                const stock = p.estado_stock ? STOCK_CFG[p.estado_stock] : null
                return (
                  <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors">
                    <div className="h-28 bg-gray-100 flex items-center justify-center border-b border-gray-100 overflow-hidden">
                      {p.imagen_principal
                        ? <img src={p.imagen_principal} alt={p.nombre} className="w-full h-full object-cover" />
                        : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                      }
                    </div>
                    <div className="p-3">
                      <div className="font-medium text-gray-900 text-[13px] truncate">{p.nombre}</div>
                      <div className="flex items-center justify-between mt-1.5">
                        <Badge text={TIPO_CFG[p.tipo].label} cls={TIPO_CFG[p.tipo].cls} />
                        {stock && <Badge text={`${stock.label} · ${p.stock}u`} cls={stock.cls} />}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[14px] font-medium text-gray-900">{formatMonto(p.precio)}</span>
                        <MargenColor pct={p.margen_pct ?? 0} />
                      </div>
                    </div>
                    <div className="px-3 pb-3 flex gap-1 border-t border-gray-100 pt-2">
                      <button
                        onClick={() => { setVista('lista'); setAjusteAbierto(p.id) }}
                        className="flex-1 text-[11px] py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
                        + Stock
                      </button>
                      {p.tipo === 'propio' && (
                        <button
                          onClick={() => setModalFabricar({ id: p.id, nombre: p.nombre, stock: p.stock })}
                          className="flex-1 text-[11px] py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                          Fabricar
                        </button>
                      )}
                      <Link href={`/dashboard/productos/${p.id}/editar`}
                        className="flex-1 text-[11px] py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 text-center">
                        Editar
                      </Link>
                    </div>
                  </div>
                )
              })
          }
        </div>
      )}
    </div>
  )
}
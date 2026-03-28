'use client'

// src/app/dashboard/productos/page.tsx

import { useState } from 'react'
import Link from 'next/link'
import { useProductos } from '@/hooks/use-productos'
import { formatMonto } from '@/lib/utils'

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

export default function ProductosPage() {
  const { productos, todos, stats, loading, error, filtros, setFiltros, limpiarFiltros } = useProductos()
  const [vista, setVista] = useState<'lista' | 'grilla'>('lista')

  // Categorías únicas para el filtro
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

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Catálogo</p>
          <h1 className="text-base font-medium text-gray-900">Productos</h1>
        </div>
        <div className="flex gap-2 items-center">
          {/* Toggle vista */}
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
          { label: 'Total productos', valor: stats.total, sub: 'en catálogo', fmt: false },
          { label: 'Valor en stock',  valor: stats.valorStock, sub: 'al costo', fmt: true },
          { label: 'Stock bajo',      valor: stats.stockBajo, sub: 'requieren reposición', fmt: false },
          { label: 'Sin publicar',    valor: stats.sinPublicar, sub: 'no visibles en tienda', fmt: false },
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
          { key: 'tipo', label: 'Tipo', opts: [['', 'Todo tipo'], ['propio', 'Propio'], ['reventa', 'Reventa'], ['consignacion', 'Consignación']] },
          { key: 'estado_stock', label: 'Stock', opts: [['', 'Todo stock'], ['bajo', 'Bajo'], ['medio', 'Medio'], ['ok', 'OK']] },
          { key: 'publicado', label: 'Visibilidad', opts: [['', 'Todos'], ['true', 'Publicados'], ['false', 'No publicados']] },
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
            <select className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
              <option>Nombre A→Z</option>
              <option>Mayor margen</option>
              <option>Menor stock</option>
            </select>
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
                  : productos.map(p => {
                      const tipo = TIPO_CFG[p.tipo]
                      const stock = p.estado_stock ? STOCK_CFG[p.estado_stock] : null
                      return (
                        <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
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
                              <Link href={`/dashboard/productos/${p.id}/editar`}
                                className="text-[11px] border border-gray-200 rounded px-2 py-1 text-gray-500 hover:bg-gray-50">
                                Editar
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
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
                    <div className="px-3 pb-3 pt-0 flex justify-between items-center border-t border-gray-100 mt-2 pt-2">
                      <span className="text-[11px] text-gray-400">{p.categoria_nombre}</span>
                      <Link href={`/dashboard/productos/${p.id}/editar`}
                        className="text-[11px] border border-gray-200 rounded px-2 py-1 text-gray-500 hover:bg-gray-50">
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
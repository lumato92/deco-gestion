'use client'

// Usar para AMBAS rutas:
// src/app/dashboard/productos/nuevo/page.tsx   → id = null
// src/app/dashboard/productos/[id]/editar/page.tsx → id = params.id

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatMonto } from '@/lib/utils'

interface Categoria { id: number; nombre: string; icono?: string }
interface Subcategoria { id: number; nombre: string }
interface Insumo { id: number; nombre: string; unidad: string; costo: number }
interface ItemReceta { insumo_id: number; nombre: string; unidad: string; cantidad: number; costo_item: number }

// ── Página nuevo ──────────────────────────────────────────────
export function NuevoProductoPage() {
  return <FormProducto id={null} />
}

// ── Página editar ─────────────────────────────────────────────
export function EditarProductoPage() {
  const params = useParams()
  const id = params?.id ? Number(params.id) : null
  return <FormProducto id={id} />
}

// ── Formulario compartido ──────────────────────────────────────
function FormProducto({ id }: { id: number | null }) {
  const router = useRouter()
  const esNuevo = id === null

  const [loading, setLoading] = useState(!esNuevo)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Datos del formulario
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<'propio' | 'reventa' | 'consignacion'>('propio')
  const [categoriaId, setCategoriaId] = useState<number | ''>('')
  const [subcategoriaId, setSubcategoriaId] = useState<number | ''>('')
  const [stock, setStock] = useState(0)
  const [costo, setCosto] = useState(0)
  const [precio, setPrecio] = useState(0)
  const [minimo, setMinimo] = useState(0)
  const [publicado, setPublicado] = useState(false)
  const [destacado, setDestacado] = useState(false)
  const [estado, setEstado] = useState<'activo' | 'pausado' | 'descontinuado'>('activo')
  const [descripcionCorta, setDescripcionCorta] = useState('')
  const [descripcionLarga, setDescripcionLarga] = useState('')
  const [varianteNombre, setVarianteNombre] = useState('')

  // Receta
  const [receta, setReceta] = useState<ItemReceta[]>([])
  const [busquedaInsumo, setBusquedaInsumo] = useState('')
  const [todosInsumos, setTodosInsumos] = useState<Insumo[]>([])
  const [resultadosInsumo, setResultadosInsumo] = useState<Insumo[]>([])

  // Catálogos
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([])

  function normalizar(str: string) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }

  // Carga inicial
  useEffect(() => {
    const supabase = createClient()
    const cargar = async () => {
      const [catRes, insumosRes] = await Promise.all([
        supabase.from('categorias').select('id, nombre, icono').order('orden'),
        supabase.from('insumos').select('id, nombre, unidad, costo').order('nombre'),
      ])
      setCategorias(catRes.data ?? [])
      setTodosInsumos(insumosRes.data ?? [])

      if (id) {
        const [prodRes, recetaRes] = await Promise.all([
          supabase.from('productos').select('*').eq('id', id).single(),
          supabase.from('recetas_detalle').select('*').eq('producto_id', id),
        ])
        if (prodRes.data) {
          const p = prodRes.data
          setNombre(p.nombre ?? '')
          setTipo(p.tipo ?? 'propio')
          setCategoriaId(p.categoria_id ?? '')
          setSubcategoriaId(p.subcategoria_id ?? '')
          setStock(p.stock ?? 0)
          setCosto(p.costo ?? 0)
          setPrecio(p.precio ?? 0)
          setMinimo(p.minimo ?? 0)
          setPublicado(p.publicado ?? false)
          setDestacado(p.destacado ?? false)
          setEstado(p.estado ?? 'activo')
          setDescripcionCorta(p.descripcion_corta ?? '')
          setDescripcionLarga(p.descripcion_larga ?? '')
          setVarianteNombre(p.variante_nombre ?? '')
          if (p.categoria_id) {
            const subRes = await supabase.from('subcategorias').select('id, nombre').eq('categoria_id', p.categoria_id).order('orden')
            setSubcategorias(subRes.data ?? [])
          }
        }
        setReceta((recetaRes.data ?? []).map((r: any) => ({
          insumo_id: r.insumo_id,
          nombre: r.insumo_nombre,
          unidad: r.unidad,
          cantidad: r.cantidad,
          costo_item: r.costo_item,
        })))
        setLoading(false)
      }
    }
    cargar()
  }, [id])

  // Cargar subcategorías al cambiar categoría
  useEffect(() => {
    if (!categoriaId) { setSubcategorias([]); setSubcategoriaId(''); return }
    createClient()
      .from('subcategorias').select('id, nombre').eq('categoria_id', categoriaId).order('orden')
      .then(({ data }) => { setSubcategorias(data ?? []); if (!id) setSubcategoriaId('') })
  }, [categoriaId])

  // Filtrar insumos
  useEffect(() => {
    if (busquedaInsumo.length < 1) { setResultadosInsumo([]); return }
    const q = normalizar(busquedaInsumo)
    setResultadosInsumo(todosInsumos.filter(i => normalizar(i.nombre).includes(q)).slice(0, 8))
  }, [busquedaInsumo, todosInsumos])

  // Cálculos
  const costoPorReceta = receta.reduce((s, r) => s + r.costo_item, 0)
  const costoFinal = tipo === 'propio' && receta.length > 0 ? costoPorReceta : costo
  const margen = precio > 0 ? Math.round((precio - costoFinal) / precio * 100) : 0

  const agregarInsumo = (ins: Insumo) => {
    if (receta.some(r => r.insumo_id === ins.id)) return
    setReceta(prev => [...prev, {
      insumo_id: ins.id, nombre: ins.nombre, unidad: ins.unidad,
      cantidad: 1, costo_item: ins.costo,
    }])
    setBusquedaInsumo('')
    setResultadosInsumo([])
  }

  const actualizarCantidadReceta = (insumoId: number, cantidad: number) => {
    const ins = todosInsumos.find(i => i.id === insumoId)
    setReceta(prev => prev.map(r =>
      r.insumo_id === insumoId
        ? { ...r, cantidad, costo_item: Math.round(cantidad * (ins?.costo ?? 0) * 100) / 100 }
        : r
    ))
  }

  const quitarInsumo = (insumoId: number) => {
    setReceta(prev => prev.filter(r => r.insumo_id !== insumoId))
  }

  const handleGuardar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    setError(null)
    const supabase = createClient()

    try {
      const datos = {
        nombre: nombre.trim(),
        tipo,
        categoria_id: categoriaId || null,
        subcategoria_id: subcategoriaId || null,
        stock,
        costo: tipo === 'propio' && receta.length > 0 ? costoPorReceta : costo,
        precio,
        minimo,
        publicado,
        destacado,
        estado,
        descripcion_corta: descripcionCorta || null,
        descripcion_larga: descripcionLarga || null,
        variante_nombre: varianteNombre || null,
      }

      let productoId = id
      if (esNuevo) {
        const { data, error: err } = await supabase.from('productos').insert(datos).select('id').single()
        if (err || !data) throw new Error(err?.message ?? 'Error al crear')
        productoId = data.id
      } else {
        const { error: err } = await supabase.from('productos').update(datos).eq('id', id!)
        if (err) throw new Error(err.message)
      }

      // Guardar receta si es propio
      if (tipo === 'propio' && productoId) {
        await supabase.from('recetas').delete().eq('producto_id', productoId)
        if (receta.length > 0) {
          await supabase.from('recetas').insert(
            receta.map(r => ({ producto_id: productoId, insumo_id: r.insumo_id, cantidad: r.cantidad }))
          )
        }
      }

      router.push('/dashboard/productos')
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3 mb-3" />
            <div className="h-10 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-5 flex flex-col gap-4">

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">
            Catálogo › {esNuevo ? 'Nuevo producto' : 'Editar producto'}
          </p>
          <h1 className="text-base font-medium text-gray-900">
            {esNuevo ? 'Nuevo producto' : nombre || 'Editar producto'}
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.back()}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando}
            className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar producto'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="grid grid-cols-[1fr_280px] gap-4 items-start">

        {/* COLUMNA PRINCIPAL */}
        <div className="flex flex-col gap-4">

          {/* Datos básicos */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-gray-900 mb-4">Datos básicos</div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Nombre *</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Maceta rústica M"
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-gray-500 uppercase tracking-wide">Categoría</label>
                  <select value={categoriaId} onChange={e => setCategoriaId(Number(e.target.value) || '')}
                    className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400">
                    <option value="">— Sin categoría —</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-gray-500 uppercase tracking-wide">Subcategoría</label>
                  <select value={subcategoriaId} onChange={e => setSubcategoriaId(Number(e.target.value) || '')}
                    disabled={!categoriaId}
                    className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400 disabled:opacity-50">
                    <option value="">— Sin subcategoría —</option>
                    {subcategorias.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Descripción corta</label>
                <input type="text" value={descripcionCorta} onChange={e => setDescripcionCorta(e.target.value)}
                  placeholder="Para catálogo y WhatsApp"
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Descripción larga</label>
                <textarea value={descripcionLarga} onChange={e => setDescripcionLarga(e.target.value)}
                  rows={3} placeholder="Para tienda online (opcional)"
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400 resize-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Variante</label>
                <input type="text" value={varianteNombre} onChange={e => setVarianteNombre(e.target.value)}
                  placeholder="Ej: Color: Verde / Tamaño: M (opcional)"
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
              </div>
            </div>
          </div>

          {/* Tipo de producto */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-gray-900 mb-3">Tipo de producto</div>
            <div className="flex gap-0 border border-gray-200 rounded-lg overflow-hidden mb-4 w-fit">
              {([
                { val: 'propio', label: 'Fabricación propia' },
                { val: 'reventa', label: 'Reventa' },
                { val: 'consignacion', label: 'Consignación' },
              ] as const).map(t => (
                <button key={t.val} onClick={() => setTipo(t.val)}
                  className={`px-3 py-1.5 text-xs font-medium border-r border-gray-200 last:border-0 transition-colors ${tipo === t.val ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Receta (solo propio) */}
            {tipo === 'propio' && (
              <div>
                <div className="text-[12px] font-medium text-gray-700 mb-2">Receta de insumos</div>
                <div className="relative mb-3">
                  <input type="text" placeholder="Buscar insumo..."
                    value={busquedaInsumo} onChange={e => setBusquedaInsumo(e.target.value)}
                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
                  {resultadosInsumo.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg z-10 overflow-hidden shadow-sm">
                      {resultadosInsumo.map(ins => (
                        <button key={ins.id} onClick={() => agregarInsumo(ins)}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
                          <div>
                            <div className="text-[12px] font-medium text-gray-900">{ins.nombre}</div>
                            <div className="text-[11px] text-gray-400">{ins.unidad}</div>
                          </div>
                          <div className="text-[11px] text-gray-500">{formatMonto(ins.costo)}/{ins.unidad}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {receta.length > 0 ? (
                  <table className="w-full text-[12px] mb-3">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left pb-2 text-[11px] font-medium text-gray-400">Insumo</th>
                        <th className="text-center pb-2 text-[11px] font-medium text-gray-400 w-24">Cantidad</th>
                        <th className="text-left pb-2 text-[11px] font-medium text-gray-400 w-16">Unidad</th>
                        <th className="text-right pb-2 text-[11px] font-medium text-gray-400 w-24">Costo</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {receta.map(r => (
                        <tr key={r.insumo_id} className="border-b border-gray-100 last:border-0">
                          <td className="py-2 font-medium text-gray-900">{r.nombre}</td>
                          <td className="py-2">
                            <input type="number" min={0} step={0.01} value={r.cantidad}
                              onChange={e => actualizarCantidadReceta(r.insumo_id, Number(e.target.value))}
                              className="w-full text-center text-[13px] text-gray-900 bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:border-teal-400" />
                          </td>
                          <td className="py-2 text-gray-500">{r.unidad}</td>
                          <td className="py-2 text-right text-gray-900">{formatMonto(r.costo_item)}</td>
                          <td className="py-2 text-center">
                            <button onClick={() => quitarInsumo(r.insumo_id)}
                              className="text-gray-300 hover:text-red-400 text-base leading-none">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-4 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg mb-3">
                    Buscá insumos para armar la receta
                  </div>
                )}

                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-[12px] text-gray-600">Costo total de fabricación</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-gray-900">{formatMonto(costoPorReceta)}</span>
                    {precio > 0 && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${margen >= 40 ? 'bg-teal-50 text-teal-700' : margen >= 20 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {margen}% margen
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="flex flex-col gap-4">

          {/* Precio y stock */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-gray-900 mb-3">Precio y stock</div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Precio de venta (efectivo)</label>
                <input type="number" min={0} value={precio} onChange={e => setPrecio(Number(e.target.value))}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
                {precio > 0 && costoFinal > 0 && (
                  <div className={`text-[11px] ${margen >= 40 ? 'text-teal-600' : margen >= 20 ? 'text-amber-600' : 'text-red-600'}`}>
                    Costo: {formatMonto(costoFinal)} · Margen: {margen}%
                  </div>
                )}
              </div>
              {tipo !== 'propio' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-gray-500 uppercase tracking-wide">Costo de compra</label>
                  <input type="number" min={0} value={costo} onChange={e => setCosto(Number(e.target.value))}
                    className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
                </div>
              )}
              <div className="h-px bg-gray-100" />
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Stock actual</label>
                <input type="number" min={0} value={stock} onChange={e => setStock(Number(e.target.value))}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Stock mínimo (alerta)</label>
                <input type="number" min={0} value={minimo} onChange={e => setMinimo(Number(e.target.value))}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
              </div>
            </div>
          </div>

          {/* Visibilidad */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-gray-900 mb-3">Visibilidad</div>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Activo', sub: 'Disponible para vender', val: estado === 'activo', set: (v: boolean) => setEstado(v ? 'activo' : 'pausado') },
                { label: 'Publicado en catálogo', sub: 'Visible en tienda online', val: publicado, set: setPublicado },
                { label: 'Destacado', sub: 'Aparece primero en catálogo', val: destacado, set: setDestacado },
              ].map(toggle => (
                <div key={toggle.label} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                  <div>
                    <div className="text-[13px] font-medium text-gray-900">{toggle.label}</div>
                    <div className="text-[11px] text-gray-400">{toggle.sub}</div>
                  </div>
                  <button onClick={() => toggle.set(!toggle.val)}
                    className={`relative w-8 h-4.5 rounded-full transition-colors flex-shrink-0 ${toggle.val ? 'bg-teal-500' : 'bg-gray-300'}`}
                    style={{ width: 32, height: 18 }}>
                    <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${toggle.val ? 'translate-x-4' : 'translate-x-0.5'}`}
                      style={{ width: 14, height: 14, top: 2, left: toggle.val ? 16 : 2 }} />
                  </button>
                </div>
              ))}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Estado</label>
                <select value={estado} onChange={e => setEstado(e.target.value as any)}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400">
                  <option value="activo">Activo</option>
                  <option value="pausado">Pausado</option>
                  <option value="descontinuado">Descontinuado</option>
                </select>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Export por defecto para la página nuevo ───────────────────
export default function NuevoProductoDefaultPage() {
  return <FormProducto id={null} />
}
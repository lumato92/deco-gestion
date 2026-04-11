'use client'

// src/components/compras/modales-inline.tsx

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ProveedorBasico { id: number; nombre: string }
export interface ItemBasico { id: number; nombre: string; stock: number; costo: number; unidad?: string }

// ── Modal nuevo proveedor inline ──────────────────────────────

export function ModalNuevoProveedor({ onGuardar, onCerrar }: {
  onGuardar: (p: ProveedorBasico) => void
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [tipo, setTipo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleGuardar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('proveedores')
      .insert({ nombre: nombre.trim(), telefono: telefono.trim() || null, tipo: tipo.trim() || null, activo: true })
      .select('id, nombre')
      .single()
    if (err || !data) { setError('Error al guardar'); setGuardando(false); return }
    onGuardar(data)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Nuevo proveedor</h3>
          <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Podés completar más datos desde Proveedores</span>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Nombre *</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Nombre del proveedor" autoFocus
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
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Rubro</label>
              <input type="text" value={tipo} onChange={e => setTipo(e.target.value)}
                placeholder="Ej: Textil"
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
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal nuevo insumo/producto inline ────────────────────────

export function ModalNuevoItem({ tipo, onGuardar, onCerrar }: {
  tipo: 'insumo' | 'producto'
  onGuardar: (item: ItemBasico) => void
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [unidad, setUnidad] = useState('unidades')
  const [costo, setCosto] = useState(0)
  const [categoria, setCategoria] = useState('')
  const [categorias, setCategorias] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const unidades = ['unidades', 'kg', 'gramos', 'litros', 'ml', 'metros', 'cm', 'hojas', 'rollos']

  useEffect(() => {
    if (tipo === 'insumo') {
      createClient().from('insumos').select('categoria').then(({ data }) => {
        const cats = [...new Set((data ?? []).map((i: any) => i.categoria).filter(Boolean))] as string[]
        setCategorias(cats)
      })
    }
  }, [tipo])

  const handleGuardar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (tipo === 'insumo' && !categoria.trim()) { setError('La categoría es obligatoria'); return }
    setGuardando(true)
    const supabase = createClient()

    if (tipo === 'insumo') {
      const { data, error: err } = await supabase
        .from('insumos')
        .insert({ nombre: nombre.trim(), categoria: categoria.trim(), unidad, costo, stock: 0, minimo: 0 })
        .select('id, nombre, stock, costo, unidad')
        .single()
      if (err || !data) { setError('Error al guardar'); setGuardando(false); return }
      onGuardar(data)
    } else {
      const { data, error: err } = await supabase
        .from('productos')
        .insert({ nombre: nombre.trim(), tipo: 'reventa', costo, precio: costo, stock: 0, minimo: 0, es_kit: false, publicado: false, destacado: false, estado: 'activo', orden_catalogo: 999 })
        .select('id, nombre, stock, costo')
        .single()
      if (err || !data) { setError('Error al guardar'); setGuardando(false); return }
      onGuardar({ ...data, unidad: 'unidades' })
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">
            Nuevo {tipo === 'insumo' ? 'insumo' : 'producto'}
          </h3>
          <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
            Podés completar más datos después
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Nombre *</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder={tipo === 'insumo' ? 'Ej: Hilo macramé natural' : 'Ej: Lámpara colgante'}
              autoFocus
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>

          {tipo === 'insumo' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Categoría *</label>
              <input type="text" value={categoria} onChange={e => setCategoria(e.target.value)}
                placeholder="Ej: Textil, Madera..."
                list="categorias-insumo"
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
              <datalist id="categorias-insumo">
                {categorias.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {tipo === 'insumo' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Unidad</label>
                <select value={unidad} onChange={e => setUnidad(e.target.value)}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400">
                  {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Costo unitario</label>
              <input type="number" min={0} value={costo} onChange={e => setCosto(Number(e.target.value))}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
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
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Selector de proveedor con opción de crear ─────────────────

export function SelectorProveedor({ value, onChange, obligatorio = false }: {
  value: ProveedorBasico | null
  onChange: (p: ProveedorBasico | null) => void
  obligatorio?: boolean
}) {
  const [busqueda, setBusqueda] = useState('')
  const [todos, setTodos] = useState<ProveedorBasico[]>([])
  const [resultados, setResultados] = useState<ProveedorBasico[]>([])
  const [abierto, setAbierto] = useState(false)
  const [modalNuevo, setModalNuevo] = useState(false)

  useEffect(() => {
    createClient().from('proveedores').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setTodos(data ?? []))
  }, [])

  useEffect(() => {
    if (busqueda.length < 1) { setResultados(todos.slice(0, 6)); return }
    const q = busqueda.toLowerCase()
    setResultados(todos.filter(p => p.nombre.toLowerCase().includes(q)).slice(0, 6))
  }, [busqueda, todos])

  if (value) {
    return (
      <>
        {modalNuevo && (
          <ModalNuevoProveedor
            onGuardar={p => { setTodos(prev => [p, ...prev]); onChange(p); setModalNuevo(false) }}
            onCerrar={() => setModalNuevo(false)}
          />
        )}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <div className="flex-1">
            <div className="text-[13px] font-medium text-gray-900">{value.nombre}</div>
          </div>
          <button onClick={() => onChange(null)}
            className="text-[11px] text-gray-400 hover:text-gray-600">Cambiar</button>
        </div>
      </>
    )
  }

  return (
    <>
      {modalNuevo && (
        <ModalNuevoProveedor
          onGuardar={p => { setTodos(prev => [p, ...prev]); onChange(p); setModalNuevo(false) }}
          onCerrar={() => setModalNuevo(false)}
        />
      )}
      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <input type="text" value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setAbierto(true) }}
            onFocus={() => { setAbierto(true); setResultados(todos.slice(0, 6)) }}
            onBlur={() => setTimeout(() => setAbierto(false), 150)}
            placeholder="Buscar proveedor..."
            className={`w-full text-sm bg-gray-50 border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400 ${obligatorio ? 'border-amber-300' : 'border-gray-200'}`} />
          {abierto && resultados.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg z-20 shadow-sm overflow-hidden max-h-48 overflow-y-auto">
              {resultados.map(p => (
                <button key={p.id}
                  onMouseDown={() => { onChange(p); setBusqueda(''); setAbierto(false) }}
                  className="w-full text-left px-3 py-2.5 text-[12px] font-medium text-gray-900 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                  {p.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setModalNuevo(true)}
          className="flex items-center gap-1.5 text-[12px] text-teal-600 font-medium hover:underline self-start">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6"/><path d="M8 5v6M5 8h6"/>
          </svg>
          Nuevo proveedor
        </button>
      </div>
    </>
  )
}

// ── Buscador de artículo con opción de crear ──────────────────

export function BuscadorArticulo({ tipoDestino, onSeleccionar }: {
  tipoDestino: 'insumo' | 'producto'
  onSeleccionar: (item: ItemBasico) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [todos, setTodos] = useState<ItemBasico[]>([])
  const [resultados, setResultados] = useState<ItemBasico[]>([])
  const [modalNuevo, setModalNuevo] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const tabla = tipoDestino === 'insumo' ? 'insumos' : 'productos_con_margen'
    supabase.from(tabla).select('id, nombre, stock, costo').order('nombre').limit(300)
      .then(({ data }) => setTodos(data ?? []))
  }, [tipoDestino])

  useEffect(() => {
    if (busqueda.length < 2) { setResultados([]); return }
    const q = busqueda.toLowerCase()
    setResultados(todos.filter(p => p.nombre.toLowerCase().includes(q)).slice(0, 6))
  }, [busqueda, todos])

  return (
    <>
      {modalNuevo && (
        <ModalNuevoItem
          tipo={tipoDestino}
          onGuardar={item => {
            setTodos(prev => [item, ...prev])
            onSeleccionar(item)
            setModalNuevo(false)
            setBusqueda('')
          }}
          onCerrar={() => setModalNuevo(false)}
        />
      )}
      <div className="flex flex-col gap-1">
        <div className="relative">
          <input type="text" placeholder={`Buscar ${tipoDestino}...`}
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          {resultados.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg z-10 shadow-sm overflow-hidden">
              {resultados.map(r => (
                <button key={r.id}
                  onClick={() => { onSeleccionar(r); setBusqueda('') }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
                  <span className="text-[12px] font-medium text-gray-900">{r.nombre}</span>
                  <span className="text-[11px] text-gray-400">Stock: {r.stock}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setModalNuevo(true)}
          className="flex items-center gap-1 text-[11px] text-teal-600 hover:underline self-start">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6"/><path d="M8 5v6M5 8h6"/>
          </svg>
          Crear {tipoDestino === 'insumo' ? 'insumo' : 'producto'} nuevo
        </button>
      </div>
    </>
  )
}
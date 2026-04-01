'use client'

// src/app/dashboard/proveedores/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMonto } from '@/lib/utils'

interface Proveedor {
  id: number
  nombre: string
  razon_social?: string
  cuit?: string
  tipo?: string
  telefono?: string
  email?: string
  persona_contacto?: string
  canal_contacto?: string
  sitio_web?: string
  direccion?: string
  condicion_pago?: string
  tiempo_entrega_dias?: number
  monto_minimo_pedido?: number
  alias_cbu?: string
  calificacion?: number
  notas?: string
  activo: boolean
  created_at: string
  // insumos vinculados (calculado)
  cant_insumos?: number
}

const CANAL_CFG: Record<string, string> = {
  whatsapp: '💬 WhatsApp',
  email:    '✉️ Email',
  telefono: '📞 Teléfono',
  visita:   '🏪 Visita',
  otro:     'Otro',
}

function normalizar(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function Estrellas({ n }: { n?: number }) {
  if (!n) return <span className="text-gray-300 text-[11px]">Sin calificar</span>
  return (
    <span className="text-amber-400 text-[13px]">
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  )
}

// ── Modal nuevo / editar proveedor ────────────────────────────

function ModalProveedor({ proveedor, onGuardar, onCerrar }: {
  proveedor?: Proveedor
  onGuardar: () => void
  onCerrar: () => void
}) {
  const [form, setForm] = useState({
    nombre:              proveedor?.nombre ?? '',
    razon_social:        proveedor?.razon_social ?? '',
    cuit:                proveedor?.cuit ?? '',
    tipo:                proveedor?.tipo ?? '',
    telefono:            proveedor?.telefono ?? '',
    email:               proveedor?.email ?? '',
    persona_contacto:    proveedor?.persona_contacto ?? '',
    canal_contacto:      proveedor?.canal_contacto ?? '',
    sitio_web:           proveedor?.sitio_web ?? '',
    direccion:           proveedor?.direccion ?? '',
    condicion_pago:      proveedor?.condicion_pago ?? '',
    tiempo_entrega_dias: proveedor?.tiempo_entrega_dias?.toString() ?? '',
    monto_minimo_pedido: proveedor?.monto_minimo_pedido?.toString() ?? '',
    alias_cbu:           proveedor?.alias_cbu ?? '',
    calificacion:        proveedor?.calificacion?.toString() ?? '',
    notas:               proveedor?.notas ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'principal' | 'comercial' | 'extra'>('principal')

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    setError('')

    const supabase = createClient()
    const datos: any = {
      nombre:              form.nombre.trim(),
      razon_social:        form.razon_social.trim() || null,
      cuit:                form.cuit.trim() || null,
      tipo:                form.tipo.trim() || null,
      telefono:            form.telefono.trim() || null,
      email:               form.email.trim() || null,
      persona_contacto:    form.persona_contacto.trim() || null,
      canal_contacto:      form.canal_contacto || null,
      sitio_web:           form.sitio_web.trim() || null,
      direccion:           form.direccion.trim() || null,
      condicion_pago:      form.condicion_pago.trim() || null,
      tiempo_entrega_dias: form.tiempo_entrega_dias ? Number(form.tiempo_entrega_dias) : null,
      monto_minimo_pedido: form.monto_minimo_pedido ? Number(form.monto_minimo_pedido) : null,
      alias_cbu:           form.alias_cbu.trim() || null,
      calificacion:        form.calificacion ? Number(form.calificacion) : null,
      notas:               form.notas.trim() || null,
      updated_at:          new Date().toISOString(),
    }

    let err
    if (proveedor) {
      const res = await supabase.from('proveedores').update(datos).eq('id', proveedor.id)
      err = res.error
    } else {
      const res = await supabase.from('proveedores').insert(datos)
      err = res.error
    }

    if (err) { setError(err.message); setGuardando(false); return }
    onGuardar()
    onCerrar()
  }

  const campo = (label: string, key: string, opts?: {
    type?: string; placeholder?: string; required?: boolean
  }) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] text-gray-500 uppercase tracking-wide">
        {label}{opts?.required && ' *'}
      </label>
      <input
        type={opts?.type ?? 'text'}
        value={(form as any)[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={opts?.placeholder ?? ''}
        className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">

        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">
            {proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {([
            { key: 'principal', label: 'Principal' },
            { key: 'comercial', label: 'Comercial' },
            { key: 'extra',     label: 'Extra' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-teal-500 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5">

          {/* Tab principal */}
          {tab === 'principal' && (
            <div className="flex flex-col gap-3">
              {campo('Nombre *', 'nombre', { required: true, placeholder: 'Nombre del proveedor o local' })}
              <div className="grid grid-cols-2 gap-3">
                {campo('Razón social', 'razon_social', { placeholder: 'Para facturas' })}
                {campo('CUIT', 'cuit', { placeholder: '20-12345678-9' })}
              </div>
              {campo('Rubro / Tipo', 'tipo', { placeholder: 'Ej: Textil, Iluminación, Carpintería...' })}
              <div className="grid grid-cols-2 gap-3">
                {campo('Teléfono', 'telefono', { placeholder: '11 XXXX XXXX' })}
                {campo('Email', 'email', { type: 'email', placeholder: 'ventas@proveedor.com' })}
              </div>
              {campo('Persona de contacto', 'persona_contacto', { placeholder: 'Nombre del vendedor' })}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Canal de contacto preferido</label>
                <select value={form.canal_contacto} onChange={e => set('canal_contacto', e.target.value)}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400">
                  <option value="">— Sin especificar —</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="telefono">Teléfono</option>
                  <option value="visita">Visita al local</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
          )}

          {/* Tab comercial */}
          {tab === 'comercial' && (
            <div className="flex flex-col gap-3">
              {campo('Condición de pago', 'condicion_pago', { placeholder: 'Ej: Contado, 30 días, Cuenta corriente' })}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-gray-500 uppercase tracking-wide">Tiempo de entrega (días)</label>
                  <input type="number" min={0} value={form.tiempo_entrega_dias}
                    onChange={e => set('tiempo_entrega_dias', e.target.value)}
                    placeholder="Ej: 3"
                    className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-gray-500 uppercase tracking-wide">Monto mínimo de pedido</label>
                  <input type="number" min={0} value={form.monto_minimo_pedido}
                    onChange={e => set('monto_minimo_pedido', e.target.value)}
                    placeholder="$0"
                    className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
                </div>
              </div>
              {campo('Alias / CBU', 'alias_cbu', { placeholder: 'Para transferencias' })}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Calificación</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => set('calificacion', n.toString())}
                      className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${
                        Number(form.calificacion) >= n
                          ? 'border-amber-400 bg-amber-50 text-amber-600'
                          : 'border-gray-200 text-gray-300 hover:border-amber-200'
                      }`}>
                      ★
                    </button>
                  ))}
                  {form.calificacion && (
                    <button onClick={() => set('calificacion', '')}
                      className="text-[11px] text-gray-400 hover:text-gray-600 px-2">
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab extra */}
          {tab === 'extra' && (
            <div className="flex flex-col gap-3">
              {campo('Dirección', 'direccion', { placeholder: 'Calle, número, ciudad' })}
              {campo('Sitio web', 'sitio_web', { placeholder: 'https://...' })}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Notas internas</label>
                <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
                  rows={4} placeholder="Observaciones, horarios de atención, condiciones especiales..."
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400 resize-none" />
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-[11px] text-red-600 px-5 pb-2">{error}</p>}

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button onClick={onCerrar}
            className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando}
            className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar proveedor'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel detalle inline ──────────────────────────────────────

function DetalleProveedor({ p, onCerrar }: { p: Proveedor; onCerrar: () => void }) {
  return (
    <tr>
      <td colSpan={6} className="p-0">
        <div className="bg-gray-50 border-t border-gray-200 p-4 grid grid-cols-3 gap-6">

          <div>
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Datos fiscales</div>
            {[
              { lbl: 'Razón social', val: p.razon_social },
              { lbl: 'CUIT',         val: p.cuit },
              { lbl: 'Dirección',    val: p.direccion },
              { lbl: 'Sitio web',    val: p.sitio_web },
            ].map(f => f.val ? (
              <div key={f.lbl} className="flex justify-between text-[12px] py-1 border-b border-gray-100 last:border-0">
                <span className="text-gray-500">{f.lbl}</span>
                <span className="font-medium text-gray-900 text-right ml-4 truncate max-w-[160px]">{f.val}</span>
              </div>
            ) : null)}
          </div>

          <div>
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Condiciones</div>
            {[
              { lbl: 'Pago',          val: p.condicion_pago },
              { lbl: 'Entrega',       val: p.tiempo_entrega_dias ? `${p.tiempo_entrega_dias} días` : null },
              { lbl: 'Mínimo',        val: p.monto_minimo_pedido ? formatMonto(p.monto_minimo_pedido) : null },
              { lbl: 'Alias / CBU',   val: p.alias_cbu },
            ].map(f => f.val ? (
              <div key={f.lbl} className="flex justify-between text-[12px] py-1 border-b border-gray-100 last:border-0">
                <span className="text-gray-500">{f.lbl}</span>
                <span className="font-medium text-gray-900">{f.val}</span>
              </div>
            ) : null)}
          </div>

          <div>
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Notas</div>
            {p.notas ? (
              <p className="text-[12px] text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 leading-relaxed">
                {p.notas}
              </p>
            ) : (
              <p className="text-[12px] text-gray-400">Sin notas</p>
            )}
            <button onClick={onCerrar} className="mt-3 text-[11px] text-gray-400 hover:text-gray-600">
              Cerrar
            </button>
          </div>

        </div>
      </td>
    </tr>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function ProveedoresPage() {
  const [todos, setTodos] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroActivo, setFiltroActivo] = useState('true')
  const [modal, setModal] = useState<{ open: boolean; proveedor?: Proveedor }>({ open: false })
  const [detalleAbierto, setDetalleAbierto] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre')
    setTodos(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Tipos únicos para filtro
  const tipos = Array.from(new Set(todos.filter(p => p.tipo).map(p => p.tipo!))).sort()

  // Filtrado local
  const proveedores = todos.filter(p => {
    if (filtroActivo !== '' && String(p.activo) !== filtroActivo) return false
    if (filtroTipo && p.tipo !== filtroTipo) return false
    if (busqueda) {
      const q = normalizar(busqueda)
      if (!normalizar(p.nombre).includes(q) &&
          !normalizar(p.tipo ?? '').includes(q) &&
          !normalizar(p.persona_contacto ?? '').includes(q)) return false
    }
    return true
  })

  const toggleActivo = async (p: Proveedor) => {
    const supabase = createClient()
    await supabase.from('proveedores').update({ activo: !p.activo }).eq('id', p.id)
    await cargar()
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este proveedor? Los insumos vinculados quedarán sin proveedor asignado.')) return
    setEliminando(id)
    const supabase = createClient()
    await supabase.from('proveedores').delete().eq('id', id)
    await cargar()
    setEliminando(null)
  }

  return (
    <div className="p-5 flex flex-col gap-4">

      {modal.open && (
        <ModalProveedor
          proveedor={modal.proveedor}
          onGuardar={cargar}
          onCerrar={() => setModal({ open: false })}
        />
      )}

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Negocio</p>
          <h1 className="text-base font-medium text-gray-900">Proveedores</h1>
        </div>
        <button onClick={() => setModal({ open: true })}
          className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">
          + Nuevo proveedor
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total proveedores', valor: todos.length },
          { label: 'Activos',           valor: todos.filter(p => p.activo).length },
          { label: 'Rubros distintos',  valor: tipos.length },
          { label: 'Con calificación',  valor: todos.filter(p => p.calificacion).length },
        ].map(m => (
          <div key={m.label} className="bg-gray-100 rounded-lg px-4 py-3">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{m.label}</div>
            <div className="text-lg font-medium text-gray-900">{m.valor}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar por nombre, rubro o contacto..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="flex-1 min-w-[180px] text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
        <div className="w-px h-5 bg-gray-200" />
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400">
          <option value="">Todos los rubros</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtroActivo} onChange={e => setFiltroActivo(e.target.value)}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400">
          <option value="true">Solo activos</option>
          <option value="false">Solo inactivos</option>
          <option value="">Todos</option>
        </select>
        <button onClick={() => { setBusqueda(''); setFiltroTipo(''); setFiltroActivo('true') }}
          className="ml-auto text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 border border-gray-200 rounded-lg">
          Limpiar
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-xs text-gray-400">
          {loading ? 'Cargando...' : `${proveedores.length} proveedores · clic en una fila para ver detalle`}
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400" style={{width:'25%'}}>Proveedor</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Rubro</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Contacto</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Canal</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Calificación</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                    </td>
                  </tr>
                ))
              : proveedores.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-xs text-gray-400">
                      No hay proveedores con los filtros seleccionados
                    </td>
                  </tr>
                )
                : proveedores.flatMap(p => [
                    <tr key={p.id}
                      onClick={() => setDetalleAbierto(prev => prev === p.id ? null : p.id)}
                      className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 ${detalleAbierto === p.id ? 'bg-blue-50' : ''} ${!p.activo ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900">{p.nombre}</div>
                        {p.cuit && <div className="text-[11px] text-gray-400">CUIT: {p.cuit}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        {p.tipo
                          ? <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">{p.tipo}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-gray-700">{p.persona_contacto ?? '—'}</div>
                        {p.telefono && <div className="text-[11px] text-gray-400">{p.telefono}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-[11px]">
                        {p.canal_contacto ? CANAL_CFG[p.canal_contacto] : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <Estrellas n={p.calificacion} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setModal({ open: true, proveedor: p })}
                            className="text-[11px] px-2 py-1 border border-gray-200 rounded text-gray-500 hover:bg-gray-50">
                            Editar
                          </button>
                          <button onClick={() => toggleActivo(p)}
                            className={`text-[11px] px-2 py-1 border rounded ${
                              p.activo
                                ? 'border-gray-200 text-gray-400 hover:text-amber-600 hover:border-amber-200'
                                : 'border-teal-200 text-teal-600 hover:bg-teal-50'
                            }`}>
                            {p.activo ? 'Pausar' : 'Activar'}
                          </button>
                          <button onClick={() => eliminar(p.id)} disabled={eliminando === p.id}
                            className="text-[11px] px-2 py-1 border border-gray-200 rounded text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 disabled:opacity-50">
                            {eliminando === p.id ? '...' : '×'}
                          </button>
                        </div>
                      </td>
                    </tr>,
                    detalleAbierto === p.id && (
                      <DetalleProveedor
                        key={`det-${p.id}`}
                        p={p}
                        onCerrar={() => setDetalleAbierto(null)}
                      />
                    )
                  ].filter(Boolean))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
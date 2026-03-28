'use client'

// src/app/dashboard/ventas/presupuestos/nuevo/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useNuevoPresupuesto } from '@/hooks/use-presupuestos'
import { formatMonto } from '@/lib/utils'
import type { CanalVenta } from '@/lib/types'

interface ProductoBuscado {
  id: number
  nombre: string
  categoria_nombre: string
  stock: number
  costo: number
  precio: number
}

interface ClienteBuscado {
  id: number
  nombre: string
  telefono: string
  canal: string
}

// ── Normalizar para búsqueda sin acentos case insensitive ─────

function normalizar(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ── Modal nuevo cliente ───────────────────────────────────────

function ModalNuevoCliente({ onGuardar, onCancelar }: {
  onGuardar: (c: ClienteBuscado) => void
  onCancelar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [canal, setCanal] = useState<CanalVenta>('whatsapp')
  const [email, setEmail] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleGuardar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('clientes')
      .insert({ nombre: nombre.trim(), telefono: telefono || null, email: email || null, canal })
      .select('id, nombre, telefono, canal')
      .single()
    if (err || !data) { setError('Error al guardar el cliente'); setGuardando(false); return }
    onGuardar(data as ClienteBuscado)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm flex flex-col gap-4">
        <h3 className="text-sm font-medium text-gray-900">Nuevo cliente</h3>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-400 uppercase tracking-wide">Nombre *</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Nombre completo o nombre del local" autoFocus
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-400 uppercase tracking-wide">Teléfono</label>
            <input type="text" value={telefono} onChange={e => setTelefono(e.target.value)}
              placeholder="11 XXXX XXXX"
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-400 uppercase tracking-wide">Canal</label>
            <select value={canal} onChange={e => setCanal(e.target.value as CanalVenta)}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400">
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="directo">Directo</option>
              <option value="tienda">Tienda</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-400 uppercase tracking-wide">Email (opcional)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Para enviar presupuestos"
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onCancelar}
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

// ── Página ────────────────────────────────────────────────────

export default function NuevoPresupuestoPage() {
  const router = useRouter()
  const {
    form, setForm, resetForm,
    agregarItem, quitarItem, actualizarItem,
    guardarPresupuesto, guardando, error,
    subtotal, descuentoMonto, total, adelanto50,
  } = useNuevoPresupuesto()

  // Productos
  const [busquedaProd, setBusquedaProd] = useState('')
  const [todosProds, setTodosProds] = useState<ProductoBuscado[]>([])
  const [resultadosProd, setResultadosProd] = useState<ProductoBuscado[]>([])

  // Clientes
  const [busquedaCli, setBusquedaCli] = useState('')
  const [todosClientes, setTodosClientes] = useState<ClienteBuscado[]>([])
  const [resultadosCli, setResultadosCli] = useState<ClienteBuscado[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteBuscado | null>(null)
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false)

  const [guardado, setGuardado] = useState(false)

  // Cargar productos al montar
  useEffect(() => {
    createClient()
      .from('productos_con_margen')
      .select('id, nombre, categoria_nombre, stock, costo, precio')
      .eq('estado', 'activo')
      .limit(200)
      .then(({ data }) => setTodosProds(data ?? []))
  }, [])

  // Cargar clientes al montar
  useEffect(() => {
    createClient()
      .from('clientes')
      .select('id, nombre, telefono, canal')
      .order('nombre')
      .limit(300)
      .then(({ data }) => setTodosClientes(data ?? []))
  }, [])

  // Filtrar productos localmente
  useEffect(() => {
    if (busquedaProd.length < 2) { setResultadosProd([]); return }
    const q = normalizar(busquedaProd)
    setResultadosProd(
      todosProds.filter(p => normalizar(p.nombre).includes(q)).slice(0, 8)
    )
  }, [busquedaProd, todosProds])

  // Filtrar clientes localmente
  useEffect(() => {
    if (busquedaCli.length < 1) { setResultadosCli([]); return }
    const q = normalizar(busquedaCli)
    setResultadosCli(
      todosClientes.filter(c =>
        normalizar(c.nombre).includes(q) ||
        (c.telefono ?? '').includes(q)
      ).slice(0, 6)
    )
  }, [busquedaCli, todosClientes])

  const seleccionarCliente = (c: ClienteBuscado) => {
    setClienteSeleccionado(c)
    setForm({ cliente_id: c.id })
    setBusquedaCli('')
    setResultadosCli([])
  }

  const nuevoClienteGuardado = (c: ClienteBuscado) => {
    setTodosClientes(prev => [c, ...prev])
    seleccionarCliente(c)
    setModalNuevoCliente(false)
  }

  const handleGuardar = async () => {
    const ok = await guardarPresupuesto()
    if (ok) setGuardado(true)
  }

  // ── Pantalla de éxito ──────────────────────────────────────

  if (guardado) {
    return (
      <div className="p-5 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-base font-medium text-gray-900">Presupuesto guardado</h2>
        <p className="text-sm text-gray-400">El cliente puede confirmarlo cuando quiera</p>
        <div className="flex gap-3 mt-2">
          <button onClick={() => { resetForm(); setGuardado(false); setClienteSeleccionado(null) }}
            className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
            Nuevo presupuesto
          </button>
          <button onClick={() => router.push('/dashboard/ventas/presupuestos')}
            className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            Ver presupuestos
          </button>
        </div>
      </div>
    )
  }

  // ── Formulario ─────────────────────────────────────────────

  return (
    <div className="p-5 flex flex-col gap-4">

      {/* Modal nuevo cliente */}
      {modalNuevoCliente && (
        <ModalNuevoCliente
          onGuardar={nuevoClienteGuardado}
          onCancelar={() => setModalNuevoCliente(false)}
        />
      )}

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Ventas › Presupuestos › Nuevo</p>
          <h1 className="text-base font-medium text-gray-900">Nuevo presupuesto</h1>
        </div>
        <button onClick={() => router.back()}
          className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-4 items-start">

        {/* COLUMNA IZQUIERDA */}
        <div className="flex flex-col gap-4">

          {/* Cliente */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-medium text-gray-900">
                Cliente
                {form.tipo_entrega === 'fabricacion' && (
                  <span className="ml-2 text-[11px] text-amber-600 font-normal">
                    obligatorio para fabricación
                  </span>
                )}
              </div>
            </div>

            {clienteSeleccionado ? (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-[11px] font-medium text-teal-800 flex-shrink-0">
                  {clienteSeleccionado.nombre.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-gray-900">{clienteSeleccionado.nombre}</div>
                  <div className="text-[11px] text-gray-400">{clienteSeleccionado.telefono}</div>
                </div>
                <button
                  onClick={() => { setClienteSeleccionado(null); setForm({ cliente_id: null }) }}
                  className="text-[11px] text-gray-400 hover:text-gray-600"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre o teléfono..."
                    value={busquedaCli}
                    onChange={e => setBusquedaCli(e.target.value)}
                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400"
                  />
                  {resultadosCli.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg z-10 overflow-hidden shadow-sm">
                      {resultadosCli.map(c => (
                        <button key={c.id} onClick={() => seleccionarCliente(c)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
                          <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-[10px] font-medium text-teal-800 flex-shrink-0">
                            {c.nombre.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-[12px] font-medium text-gray-900">{c.nombre}</div>
                            <div className="text-[11px] text-gray-400">{c.telefono}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botón nuevo cliente — siempre visible bajo el buscador */}
                <button
                  onClick={() => setModalNuevoCliente(true)}
                  className="flex items-center gap-1.5 text-[12px] text-teal-600 font-medium hover:underline self-start"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="8" cy="8" r="6"/><path d="M8 5v6M5 8h6"/>
                  </svg>
                  Nuevo cliente
                </button>
              </div>
            )}
          </div>

          {/* Productos */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-gray-900 mb-3">Productos</div>
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Buscar producto por nombre..."
                value={busquedaProd}
                onChange={e => setBusquedaProd(e.target.value)}
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400"
              />
              {resultadosProd.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-sm z-10 overflow-hidden">
                  {resultadosProd.map(p => (
                    <button key={p.id}
                      onClick={() => {
                        agregarItem({
                          producto_id: p.id,
                          nombre_producto: p.nombre,
                          cantidad: 1,
                          precio_unitario: p.precio,
                          costo_unitario: p.costo,
                          requiere_fabricacion: form.tipo_entrega === 'fabricacion',
                        })
                        setBusquedaProd('')
                        setResultadosProd([])
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-[13px] font-medium text-gray-900">{p.nombre}</div>
                        <div className="text-[11px] text-gray-400">{p.categoria_nombre}</div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className="text-[13px] font-medium text-gray-900">{formatMonto(p.precio)}</div>
                        <div className="text-[11px] text-gray-400">{p.stock} en stock</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => agregarItem({
                producto_id: null,
                nombre_producto: 'Producto personalizado',
                cantidad: 1,
                precio_unitario: 0,
                costo_unitario: 0,
                requiere_fabricacion: form.tipo_entrega === 'fabricacion',
              })}
              className="text-[11px] text-gray-400 hover:text-gray-600 mb-3"
            >
              + Agregar producto sin catálogo
            </button>

            {form.items.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                Buscá o agregá productos al presupuesto
              </div>
            ) : (
              <>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left pb-2 text-[11px] font-medium text-gray-500">Producto</th>
                      <th className="text-center pb-2 text-[11px] font-medium text-gray-500 w-20">Cant.</th>
                      <th className="text-right pb-2 text-[11px] font-medium text-gray-500 w-28">Precio</th>
                      <th className="text-right pb-2 text-[11px] font-medium text-gray-500 w-24">Subtotal</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100 last:border-0">
                        <td className="py-2">
                          <input type="text" value={item.nombre_producto}
                            onChange={e => actualizarItem(idx, { nombre_producto: e.target.value })}
                            className="w-full text-[12px] font-medium text-gray-900 bg-transparent border-0 focus:outline-none focus:bg-gray-50 rounded px-1" />
                        </td>
                        <td className="py-2">
                          <input type="number" min={1} value={item.cantidad}
                            onChange={e => actualizarItem(idx, { cantidad: Number(e.target.value) })}
                            className="w-full text-center text-[13px] text-gray-900 bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:border-teal-400" />
                        </td>
                        <td className="py-2">
                          <input type="number" min={0} value={item.precio_unitario}
                            onChange={e => actualizarItem(idx, { precio_unitario: Number(e.target.value) })}
                            className="w-full text-right text-[13px] text-gray-900 bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:border-teal-400" />
                        </td>
                        <td className="py-2 text-right font-medium text-gray-900">
                          {formatMonto(item.cantidad * item.precio_unitario)}
                        </td>
                        <td className="py-2 text-center">
                          <button onClick={() => quitarItem(idx)}
                            className="text-gray-300 hover:text-red-400 text-base leading-none">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Descuento */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className="text-[12px] text-gray-600">Descuento</span>
                  <div className="flex items-center gap-2">
                    <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                      <button onClick={() => setForm({ descuento_tipo: 'pct', descuento_valor: 0 })}
                        className={`px-2.5 py-1 text-[11px] font-medium ${form.descuento_tipo === 'pct' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>%</button>
                      <button onClick={() => setForm({ descuento_tipo: 'monto', descuento_valor: 0 })}
                        className={`px-2.5 py-1 text-[11px] font-medium border-l border-gray-200 ${form.descuento_tipo === 'monto' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>$</button>
                    </div>
                    <input type="number" min={0} value={form.descuento_valor || ''}
                      onChange={e => setForm({ descuento_valor: Number(e.target.value) })}
                      placeholder="0"
                      className="w-20 text-right text-[13px] text-gray-900 bg-white border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-teal-400" />
                    {form.descuento_valor > 0 && (
                      <span className="text-[11px] text-gray-500">
                        {form.descuento_tipo === 'pct'
                          ? `= ${formatMonto(descuentoMonto)}`
                          : `= ${((form.descuento_valor / subtotal) * 100).toFixed(1)}%`}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Detalles */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-gray-900 mb-3">Detalles</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Canal</label>
                <select value={form.canal_venta} onChange={e => setForm({ canal_venta: e.target.value as CanalVenta })}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:border-teal-400">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="directo">Directo</option>
                  <option value="tienda">Tienda</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Entrega estimada</label>
                <input type="date" value={form.fecha_entrega}
                  onChange={e => setForm({ fecha_entrega: e.target.value })}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Notas internas</label>
              <textarea value={form.notas} onChange={e => setForm({ notas: e.target.value })}
                rows={2} placeholder="Ej: cliente quiere tonos tierra, confirmar medidas..."
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400 resize-none" />
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="flex flex-col gap-4">

          {/* Tipo de entrega */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-gray-900 mb-3">Tipo de entrega</div>
            <div className="flex flex-col gap-2">
              {[
                { val: 'stock' as const, label: 'Stock disponible', hint: 'Se entrega al confirmar', color: 'teal' },
                { val: 'fabricacion' as const, label: 'Fabricación externa', hint: 'Adelanto del 50% al confirmar', color: 'amber' },
              ].map(op => (
                <label key={op.val}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    form.tipo_entrega === op.val
                      ? op.color === 'teal' ? 'border-teal-500 bg-teal-50' : 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  <input type="radio" name="entrega" checked={form.tipo_entrega === op.val}
                    onChange={() => setForm({ tipo_entrega: op.val })} className="mt-0.5" />
                  <div>
                    <div className="text-[13px] font-medium text-gray-900">{op.label}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{op.hint}</div>
                  </div>
                </label>
              ))}
            </div>
            {form.tipo_entrega === 'fabricacion' && (
              <div className="mt-3 flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Plazo del proveedor</label>
                <input type="date" value={form.fecha_compromiso_fabricacion}
                  onChange={e => setForm({ fecha_compromiso_fabricacion: e.target.value })}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400" />
              </div>
            )}
          </div>

          {/* Totales y guardar */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[12px]">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">{formatMonto(subtotal)}</span>
              </div>
              {descuentoMonto > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-gray-600">Descuento</span>
                  <span className="font-medium text-teal-700">— {formatMonto(descuentoMonto)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-[14px] font-medium text-gray-900">Total presupuestado</span>
                <span className="text-[18px] font-medium text-gray-900">{formatMonto(total)}</span>
              </div>
              {form.tipo_entrega === 'fabricacion' && total > 0 && (
                <div className="mt-1 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                  Al confirmar se cobrará un adelanto del 50% ·{' '}
                  <span className="font-medium">{formatMonto(adelanto50)}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button onClick={handleGuardar}
              disabled={guardando || form.items.length === 0}
              className="w-full py-2.5 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {guardando ? 'Guardando...' : 'Guardar presupuesto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
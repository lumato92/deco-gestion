'use client'

// src/app/dashboard/ventas/presupuestos/[id]/editar/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatMonto } from '@/lib/utils'
import type { CanalVenta } from '@/lib/types'

function normalizar(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

interface ItemEditable {
  id?: number          // existe si ya estaba en la DB
  producto_id: number | null
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  costo_unitario: number
  requiere_fabricacion: boolean
  _eliminar?: boolean  // marcado para borrar
}

interface ClienteBuscado {
  id: number
  nombre: string
  telefono: string
  canal: string
}

interface ModalNuevoClienteProps {
  onGuardar: (c: ClienteBuscado) => void
  onCancelar: () => void
}

// ── Modal nuevo cliente ───────────────────────────────────────

function ModalNuevoCliente({ onGuardar, onCancelar }: ModalNuevoClienteProps) {
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
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Nombre *</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Nombre completo o local" autoFocus
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
              <select value={canal} onChange={e => setCanal(e.target.value as CanalVenta)}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400">
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="directo">Directo</option>
                <option value="tienda">Tienda</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Email (opcional)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Para enviar el presupuesto"
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
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function EditarPresupuestoPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id ? Number(params.id) : null

  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Datos del presupuesto
  const [clienteId, setClienteId] = useState<number | null>(null)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteBuscado | null>(null)
  const [canalVenta, setCanalVenta] = useState<CanalVenta>('whatsapp')
  const [tipoEntrega, setTipoEntrega] = useState<'stock' | 'fabricacion'>('stock')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [fechaFabricacion, setFechaFabricacion] = useState('')
  const [notas, setNotas] = useState('')
  const [descuentoTipo, setDescuentoTipo] = useState<'pct' | 'monto'>('pct')
  const [descuentoValor, setDescuentoValor] = useState(0)
  const [items, setItems] = useState<ItemEditable[]>([])

  // Búsqueda de productos y clientes
  const [busquedaProd, setBusquedaProd] = useState('')
  const [todosProds, setTodosProds] = useState<any[]>([])
  const [resultadosProd, setResultadosProd] = useState<any[]>([])
  const [busquedaCli, setBusquedaCli] = useState('')
  const [todosClientes, setTodosClientes] = useState<ClienteBuscado[]>([])
  const [resultadosCli, setResultadosCli] = useState<ClienteBuscado[]>([])
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false)

  // Cargar datos del presupuesto + catálogos
  useEffect(() => {
    if (!id) return
    const supabase = createClient()

    const cargar = async () => {
      const [pedidoRes, itemsRes, clientesRes, prodsRes] = await Promise.all([
        supabase.from('pedidos').select('*').eq('id', id).single(),
        supabase.from('items_pedido').select('*').eq('pedido_id', id),
        supabase.from('clientes').select('id, nombre, telefono, canal').order('nombre').limit(300),
        supabase.from('productos_con_margen')
          .select('id, nombre, categoria_nombre, stock, costo, precio')
          .eq('estado', 'activo').limit(200),
      ])

      if (pedidoRes.data) {
        const p = pedidoRes.data
        setClienteId(p.cliente_id ?? null)
        setCanalVenta(p.canal_venta ?? 'whatsapp')
        setFechaEntrega(p.fecha_entrega ? p.fecha_entrega.split('T')[0] : '')
        setFechaFabricacion(p.fecha_compromiso_fabricacion ? p.fecha_compromiso_fabricacion.split('T')[0] : '')
        setNotas(p.notas ?? '')
        setDescuentoValor(p.descuento_pct ?? 0)

        // Tipo de entrega inferido
        const hayFabricacion = (itemsRes.data ?? []).some((i: any) => i.requiere_fabricacion)
        setTipoEntrega(hayFabricacion ? 'fabricacion' : 'stock')

        // Cargar cliente
        if (p.cliente_id && clientesRes.data) {
          const cli = clientesRes.data.find((c: any) => c.id === p.cliente_id)
          if (cli) setClienteSeleccionado(cli as ClienteBuscado)
        }
      }

      setItems((itemsRes.data ?? []).map((i: any) => ({
        id: i.id,
        producto_id: i.producto_id,
        nombre_producto: i.nombre_producto,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        costo_unitario: i.costo_unitario,
        requiere_fabricacion: i.requiere_fabricacion ?? false,
      })))

      setTodosClientes(clientesRes.data ?? [])
      setTodosProds(prodsRes.data ?? [])
      setLoading(false)
    }

    cargar()
  }, [id])

  // Filtrar productos
  useEffect(() => {
    if (busquedaProd.length < 2) { setResultadosProd([]); return }
    const q = normalizar(busquedaProd)
    setResultadosProd(todosProds.filter(p => normalizar(p.nombre).includes(q)).slice(0, 8))
  }, [busquedaProd, todosProds])

  // Filtrar clientes
  useEffect(() => {
    if (busquedaCli.length < 1) { setResultadosCli([]); return }
    const q = normalizar(busquedaCli)
    setResultadosCli(
      todosClientes.filter(c =>
        normalizar(c.nombre).includes(q) || (c.telefono ?? '').includes(q)
      ).slice(0, 6)
    )
  }, [busquedaCli, todosClientes])

  const seleccionarCliente = (c: ClienteBuscado) => {
    setClienteSeleccionado(c)
    setClienteId(c.id)
    setBusquedaCli('')
    setResultadosCli([])
  }

  const nuevoClienteGuardado = (c: ClienteBuscado) => {
    setTodosClientes(prev => [c, ...prev])
    seleccionarCliente(c)
    setModalNuevoCliente(false)
  }

  const agregarProducto = (p: any) => {
    setItems(prev => [...prev, {
      producto_id: p.id,
      nombre_producto: p.nombre,
      cantidad: 1,
      precio_unitario: p.precio,
      costo_unitario: p.costo,
      requiere_fabricacion: tipoEntrega === 'fabricacion',
    }])
    setBusquedaProd('')
    setResultadosProd([])
  }

  const actualizarItem = (idx: number, cambios: Partial<ItemEditable>) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...cambios } : item))
  }

  const eliminarItem = (idx: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      // Si tiene id (existe en DB), marcarlo para eliminar; si no, quitarlo
      if (item.id) return { ...item, _eliminar: true }
      return null
    }).filter(Boolean) as ItemEditable[])
  }

  // Cálculos
  const itemsActivos = items.filter(i => !i._eliminar)
  const subtotal = itemsActivos.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
  const descuentoMonto = descuentoTipo === 'pct'
    ? subtotal * descuentoValor / 100
    : descuentoValor
  const descuentoPct = descuentoTipo === 'monto' && subtotal > 0
    ? (descuentoValor / subtotal) * 100
    : descuentoValor
  const total = Math.round(subtotal - descuentoMonto)
  const adelanto50 = Math.round(total / 2)

  const handleGuardar = async () => {
    if (itemsActivos.length === 0) { setError('Agregá al menos un producto'); return }
    if (!id) return
    setGuardando(true)
    setError(null)
    const supabase = createClient()

    try {
      // Actualizar pedido
      const { error: errPedido } = await supabase
        .from('pedidos')
        .update({
          cliente_id: clienteId,
          canal_venta: canalVenta,
          descuento_pct: Math.round(descuentoPct * 100) / 100,
          notas: notas.trim() || null,
          fecha_entrega: fechaEntrega || null,
          fecha_compromiso_fabricacion: fechaFabricacion || null,
        })
        .eq('id', id)

      if (errPedido) throw new Error(errPedido.message)

      // Eliminar items marcados
      const idsEliminar = items.filter(i => i._eliminar && i.id).map(i => i.id!)
      if (idsEliminar.length > 0) {
        await supabase.from('items_pedido').delete().in('id', idsEliminar)
      }

      // Actualizar items existentes
      const itemsExistentes = items.filter(i => i.id && !i._eliminar)
      for (const item of itemsExistentes) {
        await supabase.from('items_pedido').update({
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          nombre_producto: item.nombre_producto,
          requiere_fabricacion: item.requiere_fabricacion,
        }).eq('id', item.id!)
      }

      // Insertar items nuevos (sin id)
      const itemsNuevos = items.filter(i => !i.id && !i._eliminar)
      if (itemsNuevos.length > 0) {
        await supabase.from('items_pedido').insert(
          itemsNuevos.map(item => ({
            pedido_id: id,
            producto_id: item.producto_id,
            nombre_producto: item.nombre_producto,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            costo_unitario: item.costo_unitario,
            requiere_fabricacion: item.requiere_fabricacion,
          }))
        )
      }

      router.push('/dashboard/ventas/presupuestos')
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar el presupuesto')
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

      {modalNuevoCliente && (
        <ModalNuevoCliente
          onGuardar={nuevoClienteGuardado}
          onCancelar={() => setModalNuevoCliente(false)}
        />
      )}

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Ventas › Presupuestos › Editar #{id}</p>
          <h1 className="text-base font-medium text-gray-900">Editar presupuesto</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push('/dashboard/ventas/presupuestos')}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando}
            className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="grid grid-cols-[1fr_300px] gap-4 items-start">

        {/* IZQUIERDA */}
        <div className="flex flex-col gap-4">

          {/* Cliente */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-gray-900 mb-3">Cliente</div>
            {clienteSeleccionado ? (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-[11px] font-medium text-teal-800 flex-shrink-0">
                  {clienteSeleccionado.nombre.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-gray-900">{clienteSeleccionado.nombre}</div>
                  <div className="text-[11px] text-gray-400">{clienteSeleccionado.telefono}</div>
                </div>
                <button onClick={() => { setClienteSeleccionado(null); setClienteId(null) }}
                  className="text-[11px] text-gray-400 hover:text-gray-600">Cambiar</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <input type="text" placeholder="Buscar cliente..."
                    value={busquedaCli} onChange={e => setBusquedaCli(e.target.value)}
                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
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
                <button onClick={() => setModalNuevoCliente(true)}
                  className="flex items-center gap-1.5 text-[12px] text-teal-600 font-medium hover:underline self-start">
                  + Nuevo cliente
                </button>
              </div>
            )}
          </div>

          {/* Productos */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-gray-900 mb-3">Productos</div>

            {/* Buscador */}
            <div className="relative mb-3">
              <input type="text" placeholder="Agregar producto..."
                value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)}
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
              {resultadosProd.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-sm z-10 overflow-hidden">
                  {resultadosProd.map(p => (
                    <button key={p.id} onClick={() => agregarProducto(p)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-[13px] font-medium text-gray-900">{p.nombre}</div>
                        <div className="text-[11px] text-gray-400">{p.categoria_nombre}</div>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <div className="text-[13px] font-medium text-gray-900">{formatMonto(p.precio)}</div>
                        <div className="text-[11px] text-gray-400">{p.stock} en stock</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sin catálogo */}
            <button
              onClick={() => setItems(prev => [...prev, {
                producto_id: null, nombre_producto: 'Producto personalizado',
                cantidad: 1, precio_unitario: 0, costo_unitario: 0,
                requiere_fabricacion: tipoEntrega === 'fabricacion',
              }])}
              className="text-[11px] text-gray-400 hover:text-gray-600 mb-3">
              + Agregar sin catálogo
            </button>

            {/* Tabla de items */}
            {itemsActivos.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                Buscá productos para agregar al presupuesto
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
                    {items.map((item, idx) => {
                      if (item._eliminar) return null
                      return (
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
                            <button onClick={() => eliminarItem(idx)}
                              className="text-gray-300 hover:text-red-400 text-base leading-none">×</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Descuento */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className="text-[12px] text-gray-600">Descuento</span>
                  <div className="flex items-center gap-2">
                    <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                      <button onClick={() => setDescuentoTipo('pct')}
                        className={`px-2.5 py-1 text-[11px] font-medium ${descuentoTipo === 'pct' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>%</button>
                      <button onClick={() => setDescuentoTipo('monto')}
                        className={`px-2.5 py-1 text-[11px] font-medium border-l border-gray-200 ${descuentoTipo === 'monto' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>$</button>
                    </div>
                    <input type="number" min={0} value={descuentoValor || ''}
                      onChange={e => setDescuentoValor(Number(e.target.value))}
                      placeholder="0"
                      className="w-20 text-right text-[13px] text-gray-900 bg-white border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-teal-400" />
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
                <select value={canalVenta} onChange={e => setCanalVenta(e.target.value as CanalVenta)}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:border-teal-400">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="directo">Directo</option>
                  <option value="tienda">Tienda</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Entrega estimada</label>
                <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Notas internas</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                placeholder="Ej: cliente quiere tonos tierra, confirmar medidas..."
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400 resize-none" />
            </div>
          </div>
        </div>

        {/* DERECHA */}
        <div className="flex flex-col gap-4">

          {/* Tipo entrega */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-gray-900 mb-3">Tipo de entrega</div>
            <div className="flex flex-col gap-2">
              {([
                { val: 'stock', label: 'Stock disponible', hint: 'Se entrega al confirmar', color: 'teal' },
                { val: 'fabricacion', label: 'Fabricación externa', hint: 'Adelanto del 50% al confirmar', color: 'amber' },
              ] as const).map(op => (
                <label key={op.val}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    tipoEntrega === op.val
                      ? op.color === 'teal' ? 'border-teal-500 bg-teal-50' : 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  <input type="radio" name="entrega" checked={tipoEntrega === op.val}
                    onChange={() => setTipoEntrega(op.val)} className="mt-0.5" />
                  <div>
                    <div className="text-[13px] font-medium text-gray-900">{op.label}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{op.hint}</div>
                  </div>
                </label>
              ))}
            </div>
            {tipoEntrega === 'fabricacion' && (
              <div className="mt-3 flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Plazo del proveedor</label>
                <input type="date" value={fechaFabricacion} onChange={e => setFechaFabricacion(e.target.value)}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400" />
              </div>
            )}
          </div>

          {/* Totales */}
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
                <span className="text-[14px] font-medium text-gray-900">Total</span>
                <span className="text-[18px] font-medium text-gray-900">{formatMonto(total)}</span>
              </div>
              {tipoEntrega === 'fabricacion' && total > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                  Al confirmar se cobrará adelanto del 50% · <span className="font-medium">{formatMonto(adelanto50)}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}

            <button onClick={handleGuardar} disabled={guardando || itemsActivos.length === 0}
              className="w-full py-2.5 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
'use client'

// src/app/dashboard/ventas/nueva/page.tsx

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useNuevaVenta } from '@/hooks/use-nueva-venta'
import { formatMonto } from '@/lib/utils'
import type { MetodoPago, CanalVenta } from '@/lib/types'

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

interface PagoPointPendiente {
  mp_pago_id: string
  monto: number
  medio: string | null
  cuotas: number
}

function normalizar(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ── Modal popup de confirmación ────────────────────────────────────────────────
function PopupExito({ total, pedidoId, entregaInmediata, linkMP, pagoPointAsignado, onNuevaVenta, onDashboard }: {
  total: number
  pedidoId: number
  entregaInmediata: boolean
  linkMP?: string
  pagoPointAsignado?: boolean
  onNuevaVenta: () => void
  onDashboard: () => void
}) {
  const [copiado, setCopiado] = useState(false)

  const copiarLink = () => {
    if (!linkMP) return
    navigator.clipboard.writeText(linkMP)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-sm text-center flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-medium text-gray-900">Venta registrada</h2>
          <p className="text-sm text-gray-400 mt-1">
            {formatMonto(total)} · Stock descontado automáticamente
          </p>
        </div>

        {pagoPointAsignado && (
          <div className="w-full bg-teal-50 border border-teal-200 rounded-lg px-3 py-2.5 text-[12px] text-teal-800">
            ✓ Pago del Point asignado a esta venta
          </div>
        )}

        {linkMP && (
          <div className="w-full flex flex-col gap-2">
            <p className="text-[12px] text-gray-500 text-left">
              Link de pago generado — compartilo con el cliente
            </p>
            <div className="flex gap-2">
              <input readOnly value={linkMP}
                className="flex-1 text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 truncate" />
              <button onClick={copiarLink}
                className="px-3 py-1.5 text-[11px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap">
                {copiado ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <a href={linkMP} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-blue-600 hover:underline text-left">
              Abrir en Mercado Pago →
            </a>
          </div>
        )}

        {entregaInmediata && (
          <div className="w-full flex flex-col gap-2">
            <p className="text-[12px] text-gray-500 text-left">Documentos disponibles</p>
            <div className="flex gap-2">
              <a href={`/api/pdf/ticket?id=${pedidoId}`} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2 text-[12px] font-medium text-center bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                Ticket de caja
              </a>
              <a href={`/api/pdf/remito?id=${pedidoId}`} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2 text-[12px] font-medium text-center border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                Remito
              </a>
            </div>
          </div>
        )}

        <div className="flex gap-3 w-full">
          <button onClick={onNuevaVenta}
            className="flex-1 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
            Nueva venta
          </button>
          <button onClick={onDashboard}
            className="flex-1 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            Ir al dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal nuevo cliente ────────────────────────────────────────────────────────
function ModalNuevoCliente({ onGuardar, onCancelar }: {
  onGuardar: (cliente: ClienteBuscado) => void
  onCancelar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [canal, setCanal] = useState<CanalVenta>('directo')
  const [email, setEmail] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleGuardar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('clientes')
      .insert({ nombre: nombre.trim(), telefono: telefono.trim() || null, email: email.trim() || null, canal })
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
              <option value="directo">Directo</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
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
          <button onClick={onCancelar} className="flex-1 py-2 text-xs font-medium border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
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

// ── Método de pago btn ─────────────────────────────────────────────────────────
function MetodoPagoBtn({ label, hint, selected, onClick }: {
  label: string; hint: string; selected: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick}
      className={`p-3 rounded-lg border text-left transition-colors ${selected ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
      <div className="text-[13px] font-medium text-gray-900">{label}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>
    </button>
  )
}

// ── Formulario inline de producto libre ───────────────────────────────────────
function FormProductoLibre({ onAgregar, onCancelar }: {
  onAgregar: (nombre: string, precio: number, cantidad: number) => void
  onCancelar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState<number | ''>('')
  const [cantidad, setCantidad] = useState(1)
  const [error, setError] = useState('')

  const handleAgregar = () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!precio || precio <= 0) { setError('El precio debe ser mayor a 0'); return }
    onAgregar(nombre.trim(), Number(precio), cantidad)
  }

  return (
    <div className="mt-3 border border-dashed border-purple-300 bg-purple-50 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] font-medium text-purple-700 uppercase tracking-wide">Producto libre</span>
        <span className="text-[10px] text-purple-400">sin stock ni catálogo</span>
      </div>
      <input type="text" placeholder="Nombre del producto o servicio..."
        value={nombre} onChange={e => { setNombre(e.target.value); setError('') }} autoFocus
        className="text-sm bg-white border border-purple-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400" />
      <div className="flex gap-2">
        <input type="number" placeholder="Precio unitario" min={0} value={precio}
          onChange={e => { setPrecio(e.target.value === '' ? '' : Number(e.target.value)); setError('') }}
          className="flex-1 text-sm bg-white border border-purple-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400" />
        <input type="number" placeholder="Cant." min={1} value={cantidad}
          onChange={e => setCantidad(Math.max(1, Number(e.target.value)))}
          className="w-20 text-sm bg-white border border-purple-200 rounded-lg px-3 py-2 text-gray-900 text-center focus:outline-none focus:border-purple-400" />
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancelar}
          className="flex-1 py-1.5 text-[12px] border border-gray-200 rounded-lg text-gray-500 hover:bg-white">
          Cancelar
        </button>
        <button onClick={handleAgregar}
          className="flex-1 py-1.5 text-[12px] font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Agregar
        </button>
      </div>
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────────
function NuevaVentaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const desdePoint = searchParams.get('desde') === 'point'

  const {
    form, setForm, resetForm,
    agregarItem, quitarItem, actualizarItem,
    confirmarVenta, guardando, error,
    subtotal, descuentoMonto, recargoPct, recargoMonto, total,
  } = useNuevaVenta()

  const [busquedaProd, setBusquedaProd] = useState('')
  const [resultadosProd, setResultadosProd] = useState<ProductoBuscado[]>([])
  const [todosProds, setTodosProds] = useState<ProductoBuscado[]>([])
  const [mostrarFormLibre, setMostrarFormLibre] = useState(false)

  const [mostrarCliente, setMostrarCliente] = useState(false)
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false)
  const [busquedaCli, setBusquedaCli] = useState('')
  const [todosClientes, setTodosClientes] = useState<ClienteBuscado[]>([])
  const [resultadosCli, setResultadosCli] = useState<ClienteBuscado[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteBuscado | null>(null)

  const [ventaConfirmada, setVentaConfirmada] = useState(false)
  const [totalConfirmado, setTotalConfirmado] = useState(0)
  const [pedidoIdConfirmado, setPedidoIdConfirmado] = useState(0)
  const [entregaInmediataConfirmada, setEntregaInmediataConfirmada] = useState(false)
  const [linkMP, setLinkMP] = useState<string | undefined>(undefined)
  const [pagoPointAsignado, setPagoPointAsignado] = useState(false)
  const [pagoPoint, setPagoPoint] = useState<PagoPointPendiente | null>(null)

  useEffect(() => {
    if (desdePoint) {
      const stored = sessionStorage.getItem('point_pago_pendiente')
      if (stored) {
        try {
          const datos = JSON.parse(stored)
          setPagoPoint(datos)
          // Flag para que confirmarVenta NO registre el pago — lo hace point/asignar
          setForm({ desde_point: true })
        } catch {}
      }
    }
  }, [desdePoint])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('productos_con_margen')
      .select('id, nombre, categoria_nombre, stock, costo, precio')
      .eq('estado', 'activo').limit(200)
      .then(({ data }) => setTodosProds(data ?? []))
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('clientes').select('id, nombre, telefono, canal').order('nombre').limit(300)
      .then(({ data }) => setTodosClientes(data ?? []))
  }, [])

  useEffect(() => {
    if (busquedaProd.length < 2) { setResultadosProd([]); return }
    const q = normalizar(busquedaProd)
    setResultadosProd(todosProds.filter(p => normalizar(p.nombre).includes(q)).slice(0, 8))
  }, [busquedaProd, todosProds])

  useEffect(() => {
    if (busquedaCli.length < 1) { setResultadosCli([]); return }
    const q = normalizar(busquedaCli)
    setResultadosCli(
      todosClientes.filter(c => normalizar(c.nombre).includes(q) || (c.telefono ?? '').includes(q)).slice(0, 6)
    )
  }, [busquedaCli, todosClientes])

  const seleccionarCliente = (c: ClienteBuscado) => {
    setClienteSeleccionado(c)
    setForm({ cliente_id: c.id })
    setBusquedaCli('')
    setResultadosCli([])
    setMostrarCliente(false)
  }

  const nuevoClienteGuardado = (c: ClienteBuscado) => {
    setTodosClientes(prev => [c, ...prev])
    seleccionarCliente(c)
    setModalNuevoCliente(false)
  }

  const agregarProductoLibre = (nombre: string, precio: number, cantidad: number) => {
    agregarItem({ producto_id: null, nombre_producto: nombre, cantidad, precio_unitario: precio, costo_unitario: 0, requiere_fabricacion: false })
    setMostrarFormLibre(false)
  }

  const handleConfirmar = async () => {
    const montoFinal = total
    const esMercadoPago = form.metodo_pago === 'mercadopago'
    const fueEntregaInmediata = form.entrega_inmediata

    const pedidoId = await confirmarVenta()
    if (pedidoId === false) return

    setTotalConfirmado(montoFinal)
    setPedidoIdConfirmado(pedidoId)
    setEntregaInmediataConfirmada(fueEntregaInmediata)

    // Asignar pago Point — este es el ÚNICO registro de pago cuando viene desde Point
    if (pagoPoint) {
      try {
        const res = await fetch('/api/pagos/point/asignar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mp_pago_id: pagoPoint.mp_pago_id, pedido_id: pedidoId }),
        })
        if (res.ok) {
          sessionStorage.removeItem('point_pago_pendiente')
          setPagoPointAsignado(true)
        }
      } catch {}
    }

    if (esMercadoPago) {
      try {
        const res = await fetch('/api/pagos/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pedido_id: pedidoId,
            descripcion: `Pedido #${pedidoId}${clienteSeleccionado ? ` - ${clienteSeleccionado.nombre}` : ''}`,
            monto: montoFinal,
            email_cliente: undefined,
          }),
        })
        const data = await res.json()
        if (data.link) setLinkMP(data.link)
      } catch {}
    }

    setVentaConfirmada(true)
  }

  const medioLabel: Record<string, string> = {
    debit_card: 'Débito', credit_card: 'Crédito', prepaid_card: 'Prepaga',
    debvisa: 'Visa débito', debmaster: 'Master débito',
    visa: 'Visa crédito', master: 'Master crédito', amex: 'Amex',
  }

  return (
    <div className="p-5 flex flex-col gap-4">

      {ventaConfirmada && (
        <PopupExito
          total={totalConfirmado}
          pedidoId={pedidoIdConfirmado}
          entregaInmediata={entregaInmediataConfirmada}
          linkMP={linkMP}
          pagoPointAsignado={pagoPointAsignado}
          onNuevaVenta={() => {
            resetForm()
            setVentaConfirmada(false)
            setClienteSeleccionado(null)
            setMostrarCliente(false)
            setLinkMP(undefined)
            setEntregaInmediataConfirmada(false)
            setPagoPointAsignado(false)
            setPagoPoint(null)
          }}
          onDashboard={() => router.push('/dashboard')}
        />
      )}

      {modalNuevoCliente && (
        <ModalNuevoCliente onGuardar={nuevoClienteGuardado} onCancelar={() => setModalNuevoCliente(false)} />
      )}

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Ventas › Nueva venta</p>
          <h1 className="text-base font-medium text-gray-900">Nueva venta</h1>
        </div>
        <button onClick={() => router.back()}
          className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-500 hover:bg-gray-50">
          Cancelar
        </button>
      </div>

      {pagoPoint && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <div>
              <span className="text-[13px] font-medium text-amber-900">
                Pago Point a asignar: {formatMonto(pagoPoint.monto)}
              </span>
              <span className="ml-2 text-[12px] text-amber-700">
                · {pagoPoint.medio ? (medioLabel[pagoPoint.medio] ?? pagoPoint.medio) : '—'}
                {pagoPoint.cuotas > 1 ? ` · ${pagoPoint.cuotas} cuotas` : ''}
              </span>
            </div>
          </div>
          <span className="text-[11px] text-amber-600">Se asignará al confirmar la venta</span>
        </div>
      )}

      <div className="grid grid-cols-[1fr_320px] gap-4 items-start">

        {/* COLUMNA IZQUIERDA */}
        <div className="flex flex-col gap-4">

          {/* Productos */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-medium text-gray-900">Productos</div>
              {!mostrarFormLibre && (
                <button onClick={() => setMostrarFormLibre(true)}
                  className="text-[11px] text-purple-600 font-medium hover:underline">
                  + Producto libre
                </button>
              )}
            </div>

            <div className="relative mb-3">
              <input type="text" placeholder="Buscar producto por nombre..."
                value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)}
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
              {resultadosProd.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-sm z-10 overflow-hidden">
                  {resultadosProd.map(p => (
                    <button key={p.id}
                      onClick={() => {
                        agregarItem({ producto_id: p.id, nombre_producto: p.nombre, cantidad: 1, precio_unitario: p.precio, costo_unitario: p.costo, requiere_fabricacion: false })
                        setBusquedaProd(''); setResultadosProd([])
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-[13px] font-medium text-gray-900">{p.nombre}</div>
                        <div className="text-[11px] text-gray-400">{p.categoria_nombre}</div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className="text-[13px] font-medium text-gray-900">{formatMonto(p.precio)}</div>
                        <div className={`text-[11px] ${p.stock <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {p.stock <= 0 ? 'Sin stock' : `${p.stock} en stock`}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {mostrarFormLibre && (
              <FormProductoLibre onAgregar={agregarProductoLibre} onCancelar={() => setMostrarFormLibre(false)} />
            )}

            {form.items.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                Buscá un producto para agregarlo
              </div>
            ) : (
              <>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left pb-2 text-[11px] font-medium text-gray-500">Producto</th>
                      <th className="text-center pb-2 text-[11px] font-medium text-gray-500 w-20">Cant.</th>
                      <th className="text-right pb-2 text-[11px] font-medium text-gray-500 w-28">Precio unit.</th>
                      <th className="text-right pb-2 text-[11px] font-medium text-gray-500 w-24">Subtotal</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100 last:border-0">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{item.nombre_producto}</span>
                            {item.producto_id === null && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">libre</span>
                            )}
                          </div>
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
                          <button onClick={() => quitarItem(idx)} className="text-gray-300 hover:text-red-400 text-base leading-none">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

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

          {/* Cliente */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-medium text-gray-900">Cliente</div>
              {!mostrarCliente && !clienteSeleccionado && (
                <button onClick={() => setMostrarCliente(true)}
                  className="text-[11px] text-teal-600 font-medium hover:underline">
                  Identificar cliente
                </button>
              )}
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
                <button onClick={() => { setClienteSeleccionado(null); setForm({ cliente_id: null }); setMostrarCliente(false) }}
                  className="text-[11px] text-gray-400 hover:text-gray-600">Quitar</button>
              </div>
            ) : mostrarCliente ? (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <input type="text" placeholder="Buscar por nombre o teléfono..."
                    value={busquedaCli} onChange={e => setBusquedaCli(e.target.value)} autoFocus
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
                <div className="flex items-center gap-3">
                  <button onClick={() => setModalNuevoCliente(true)}
                    className="text-[11px] text-teal-600 font-medium hover:underline">
                    + Cargar nuevo cliente
                  </button>
                  <span className="text-gray-300 text-xs">·</span>
                  <button onClick={() => { setMostrarCliente(false); setBusquedaCli(''); setResultadosCli([]) }}
                    className="text-[11px] text-gray-400 hover:text-gray-600">Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2.5 text-[12px] text-gray-400">
                Venta sin cliente identificado — opcional
              </div>
            )}
          </div>

          {/* Detalles — fecha + canal */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-gray-900 mb-3">Detalles</div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Fecha de la venta</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={e => setForm({ fecha: e.target.value })}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-teal-400"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">Canal de venta</label>
                <select value={form.canal_venta} onChange={e => setForm({ canal_venta: e.target.value as CanalVenta })}
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400">
                  <option value="directo">Directo (local físico)</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="tienda">Tienda</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="flex flex-col gap-4">

          {/* Método de pago */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-gray-900 mb-3">Método de pago</div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'efectivo',      label: 'Efectivo',      hint: 'Sin recargo' },
                { key: 'transferencia', label: 'Transferencia', hint: 'Sin recargo' },
                { key: 'debito',        label: 'Débito',        hint: '+10% recargo' },
                { key: 'credito',       label: 'Crédito',       hint: '+20% recargo' },
                { key: 'mercadopago',   label: 'Mercado Pago',  hint: 'Link online' },
              ] as const).map(m => (
                <MetodoPagoBtn key={m.key} label={m.label} hint={m.hint}
                  selected={form.metodo_pago === m.key}
                  onClick={() => setForm({ metodo_pago: m.key })} />
              ))}
            </div>

            {form.metodo_pago === 'mercadopago' && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  Se generará un link de pago al confirmar la venta.
                </p>
              </div>
            )}

            {form.metodo_pago !== 'mercadopago' && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.con_sena}
                    onChange={e => setForm({ con_sena: e.target.checked })} className="rounded" />
                  <span className="text-[12px] text-gray-700">El cliente deja una seña</span>
                </label>
                {form.con_sena && (
                  <div className="mt-2 flex items-center gap-2">
                    <input type="number" min={0} value={form.monto_sena || ''}
                      onChange={e => setForm({ monto_sena: Number(e.target.value) })}
                      placeholder="Monto de la seña"
                      className="flex-1 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-400" />
                    <span className="text-[11px] text-gray-400">efectivo</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Entrega */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-gray-900 mb-3">Entrega</div>
            {form.metodo_pago !== 'mercadopago' ? (
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                form.entrega_inmediata ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input type="checkbox" checked={form.entrega_inmediata}
                  onChange={e => setForm({ entrega_inmediata: e.target.checked })}
                  className="mt-0.5 rounded" />
                <div>
                  <div className="text-[13px] font-medium text-gray-900">Entrega inmediata</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    El cliente retira en este momento — genera ticket disponible al confirmar
                  </div>
                </div>
              </label>
            ) : (
              <p className="text-[12px] text-gray-400">
                Para ventas con Mercado Pago la entrega se confirma cuando se acredita el pago.
              </p>
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
              {recargoPct > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-gray-600">Recargo {form.metodo_pago}</span>
                  <span className="font-medium text-amber-700">+ {formatMonto(recargoMonto)}</span>
                </div>
              )}

              {pagoPoint && total > 0 && (
                <div className={`flex justify-between text-[12px] pt-1.5 border-t border-gray-100 ${
                  Math.abs(pagoPoint.monto - total) <= 5 ? 'text-teal-600' : 'text-amber-600'
                }`}>
                  <span>Point cobró</span>
                  <span className="font-medium">{formatMonto(pagoPoint.monto)}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-[14px] font-medium text-gray-900">Total a cobrar</span>
                <span className="text-[18px] font-medium text-gray-900">{formatMonto(total)}</span>
              </div>
            </div>

            {error && (
              <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}

            <button onClick={handleConfirmar}
              disabled={guardando || form.items.length === 0}
              className="w-full py-2.5 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {guardando
                ? 'Registrando...'
                : form.metodo_pago === 'mercadopago'
                  ? `Confirmar y generar link · ${formatMonto(total)}`
                  : form.entrega_inmediata
                    ? `Confirmar entrega · ${formatMonto(total)}`
                    : pagoPoint
                      ? `Confirmar y asignar pago Point · ${formatMonto(total)}`
                      : `Confirmar venta · ${formatMonto(total)}`
              }
            </button>
            <button onClick={() => router.push('/dashboard/ventas/presupuestos/nuevo')}
              className="w-full py-2 text-[12px] text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
              Guardar como presupuesto en cambio
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NuevaVentaPage() {
  return (
    <Suspense fallback={<div className="p-5 text-xs text-gray-400">Cargando...</div>}>
      <NuevaVentaContent />
    </Suspense>
  )
}
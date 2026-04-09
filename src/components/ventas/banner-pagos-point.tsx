'use client'

// src/components/ventas/banner-pagos-point.tsx

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatMonto, formatFecha } from '@/lib/utils'

interface PagoPoint {
  id: number
  mp_pago_id: string
  monto: number
  monto_neto: number
  comisiones: number
  medio: string | null
  cuotas: number
  fecha_pago: string
  estado: string
}

interface PedidoBasico {
  id: number
  cliente_nombre: string | null
  total_cobrado: number
  pendiente: number
  fecha_pedido: string
}

function normalizar(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const medioLabel: Record<string, string> = {
  debit_card:   'Débito',
  credit_card:  'Crédito',
  prepaid_card: 'Prepaga',
  debvisa:      'Visa débito',
  debmaster:    'Master débito',
  visa:         'Visa crédito',
  master:       'Master crédito',
  amex:         'Amex crédito',
}

// ── Modal para asignar un pago Point ─────────────────────────

function ModalAsignar({ pago, onAsignado, onCerrar }: {
  pago: PagoPoint
  onAsignado: () => void
  onCerrar: () => void
}) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [pedidos, setPedidos] = useState<PedidoBasico[]>([])
  const [resultados, setResultados] = useState<PedidoBasico[]>([])
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<PedidoBasico | null>(null)
  const [asignando, setAsignando] = useState(false)
  const [error, setError] = useState('')

  // Cargamos TODOS los pedidos recientes — pendientes y cobrados
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('pedidos_con_total')
      .select('id, cliente_nombre, total_cobrado, pendiente, fecha_pedido')
      .not('estado', 'in', '("cancelado","presupuesto")')
      .order('fecha_pedido', { ascending: false })
      .limit(100)
      .then(({ data }) => setPedidos(data ?? []))
  }, [])

  useEffect(() => {
    if (busqueda.length < 1) {
      setResultados(pedidos.slice(0, 8))
      return
    }
    const q = normalizar(busqueda)
    setResultados(
      pedidos.filter(p =>
        normalizar(p.cliente_nombre ?? '').includes(q) ||
        String(p.id).includes(q)
      ).slice(0, 8)
    )
  }, [busqueda, pedidos])

  // Diferencia entre lo cobrado por el Point y el total del pedido
  const diferencia = pedidoSeleccionado
    ? pago.monto - pedidoSeleccionado.total_cobrado
    : 0
  const tolerancia = 5 // pesos de tolerancia por redondeo
  const coincide = Math.abs(diferencia) <= tolerancia

  const handleAsignar = async () => {
    if (!pedidoSeleccionado) { setError('Seleccioná un pedido'); return }
    setAsignando(true)
    setError('')
    try {
      const res = await fetch('/api/pagos/point/asignar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mp_pago_id: pago.mp_pago_id,
          pedido_id: pedidoSeleccionado.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al asignar')
      onAsignado()
      onCerrar()
    } catch (e: any) {
      setError(e.message ?? 'Error al asignar')
      setAsignando(false)
    }
  }

  const handleCrearVenta = () => {
    // Guardamos el pago Point en sessionStorage para asignarlo al volver
    sessionStorage.setItem('point_pago_pendiente', JSON.stringify({
      mp_pago_id: pago.mp_pago_id,
      monto: pago.monto,
      medio: pago.medio,
      cuotas: pago.cuotas,
    }))
    onCerrar()
    router.push('/dashboard/ventas/nueva?desde=point')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md flex flex-col gap-4">

        {/* Header */}
        <div>
          <h3 className="text-sm font-medium text-gray-900">Asignar pago Point</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Buscá el pedido correspondiente o creá una venta nueva
          </p>
        </div>

        {/* Detalle del pago */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col gap-2">
          <div className="flex justify-between text-[12px]">
            <span className="text-gray-500">Monto cobrado por Point</span>
            <span className="font-medium text-gray-900">{formatMonto(pago.monto)}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-gray-500">Comisión MP</span>
            <span className="text-red-600">— {formatMonto(pago.comisiones)}</span>
          </div>
          <div className="flex justify-between text-[12px] pt-1.5 border-t border-gray-200">
            <span className="text-gray-700 font-medium">Neto acreditado</span>
            <span className="font-medium text-teal-700">{formatMonto(pago.monto_neto)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 pt-1">
            <span>
              {pago.medio ? (medioLabel[pago.medio] ?? pago.medio) : '—'}
              {pago.cuotas > 1 ? ` · ${pago.cuotas} cuotas` : ' · 1 pago'}
            </span>
            <span>{formatFecha(pago.fecha_pago)}</span>
          </div>
        </div>

        {/* Buscador de pedidos */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-gray-500 uppercase tracking-wide">
            Buscar pedido existente
          </label>
          {pedidoSeleccionado ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2.5">
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-gray-900">
                    #{pedidoSeleccionado.id} — {pedidoSeleccionado.cliente_nombre ?? '(sin cliente)'}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Total venta: {formatMonto(pedidoSeleccionado.total_cobrado)}
                    {pedidoSeleccionado.pendiente > 0 && (
                      <span className="ml-2 text-amber-600">· Pendiente: {formatMonto(pedidoSeleccionado.pendiente)}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setPedidoSeleccionado(null)}
                  className="text-[11px] text-gray-400 hover:text-gray-600"
                >
                  Cambiar
                </button>
              </div>

              {/* Comparación de montos */}
              {coincide ? (
                <div className="flex items-center gap-2 text-[11px] text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                  <span>✓</span>
                  <span>Los montos coinciden — todo OK</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <div className="text-[11px] font-medium text-amber-800">
                    Diferencia de {formatMonto(Math.abs(diferencia))}
                  </div>
                  <div className="text-[11px] text-amber-700">
                    {diferencia > 0
                      ? `El Point cobró ${formatMonto(diferencia)} más que el total de la venta (recargo tarjeta aplicado en Point)`
                      : `El Point cobró ${formatMonto(Math.abs(diferencia))} menos que el total de la venta`
                    }
                  </div>
                  <div className="text-[11px] text-amber-600 mt-0.5">
                    Podés asignar igual — el sistema registra el pago real del Point.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="Nombre del cliente o número de pedido..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                autoFocus
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400"
              />
              {resultados.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg z-10 overflow-hidden shadow-sm max-h-48 overflow-y-auto">
                  {resultados.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setPedidoSeleccionado(p); setBusqueda('') }}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <div className="text-[12px] font-medium text-gray-900">
                          #{p.id} — {p.cliente_nombre ?? '(sin cliente)'}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Total: {formatMonto(p.total_cobrado)}
                          {p.pendiente > 0
                            ? <span className="ml-2 text-amber-600">· Pendiente: {formatMonto(p.pendiente)}</span>
                            : <span className="ml-2 text-teal-600">· Cobrado</span>
                          }
                        </div>
                      </div>
                      <div className={`text-[11px] flex-shrink-0 ml-3 font-medium ${
                        Math.abs(pago.monto - p.total_cobrado) <= tolerancia
                          ? 'text-teal-600'
                          : 'text-gray-400'
                      }`}>
                        {Math.abs(pago.monto - p.total_cobrado) <= tolerancia ? '✓ coincide' : formatMonto(p.total_cobrado)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Separador con "o" */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[11px] text-gray-400">o</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Crear venta nueva */}
        <button
          onClick={handleCrearVenta}
          className="w-full py-2.5 text-[12px] font-medium border-2 border-dashed border-teal-300 text-teal-700 rounded-lg hover:bg-teal-50 transition-colors"
        >
          + Crear venta nueva para este pago
        </button>

        {error && <p className="text-[11px] text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onCerrar}
            className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleAsignar}
            disabled={asignando || !pedidoSeleccionado}
            className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {asignando ? 'Asignando...' : 'Confirmar asignación'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Banner principal ──────────────────────────────────────────

export function BannerPagosPoint({ onAsignado }: { onAsignado: () => void }) {
  const [pagos, setPagos] = useState<PagoPoint[]>([])
  const [expandido, setExpandido] = useState(false)
  const [modalPago, setModalPago] = useState<PagoPoint | null>(null)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('pagos_point_pendientes')
      .select('*')
      .eq('estado', 'pendiente')
      .order('fecha_pago', { ascending: false })
    setPagos(data ?? [])
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (pagos.length === 0) return null

  return (
    <>
      {modalPago && (
        <ModalAsignar
          pago={modalPago}
          onAsignado={() => { cargar(); onAsignado() }}
          onCerrar={() => setModalPago(null)}
        />
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setExpandido(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[13px] font-medium text-amber-900">
              {pagos.length} pago{pagos.length > 1 ? 's' : ''} del Point sin asignar
            </span>
            <span className="text-[12px] text-amber-700">
              · Total: {formatMonto(pagos.reduce((s, p) => s + p.monto, 0))}
            </span>
          </div>
          <span className="text-[11px] text-amber-600">
            {expandido ? 'Ocultar ▲' : 'Ver y asignar ▼'}
          </span>
        </button>

        {expandido && (
          <div className="border-t border-amber-200">
            {pagos.map(pago => (
              <div
                key={pago.id}
                className="flex items-center justify-between px-4 py-3 border-b border-amber-100 last:border-0 bg-white"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-[13px] font-medium text-gray-900">
                      {formatMonto(pago.monto)}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {pago.medio ? (medioLabel[pago.medio] ?? pago.medio) : '—'}
                      {pago.cuotas > 1 ? ` · ${pago.cuotas} cuotas` : ''}
                      {' · '}{formatFecha(pago.fecha_pago)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[12px]">
                    <span className="text-gray-500">
                      Neto: <span className="text-teal-700 font-medium">{formatMonto(pago.monto_neto)}</span>
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500">
                      Comisión: <span className="text-red-600">— {formatMonto(pago.comisiones)}</span>
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setModalPago(pago)}
                  className="text-[11px] px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium flex-shrink-0"
                >
                  Asignar a pedido
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
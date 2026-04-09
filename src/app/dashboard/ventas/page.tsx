'use client'

// src/app/dashboard/ventas/page.tsx

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useVentas } from '@/hooks/use-ventas'
import { createClient } from '@/lib/supabase/client'
import { formatMonto, formatFecha } from '@/lib/utils'
import { ModalAccionesVenta } from '@/components/ventas/modal-acciones'
import type { EstadoPedido, MetodoPago, CanalVenta, PedidoConTotal } from '@/lib/types'
import { BannerPagosPoint } from '@/components/ventas/banner-pagos-point'

// ── Config visual ─────────────────────────────────────────────

const ESTADO_CFG: Record<EstadoPedido, { label: string; cls: string }> = {
  presupuesto:    { label: 'Presupuesto',    cls: 'bg-blue-50 text-blue-800' },
  confirmado:     { label: 'Confirmada',     cls: 'bg-teal-50 text-teal-800' },
  reservado:      { label: 'Reservado',      cls: 'bg-purple-50 text-purple-800' },
  en_fabricacion: { label: 'En fabricación', cls: 'bg-amber-50 text-amber-800' },
  entregado:      { label: 'Entregada',      cls: 'bg-teal-50 text-teal-800' },
  cancelado:      { label: 'Cancelada',      cls: 'bg-gray-100 text-gray-500' },
}

const MP_CFG: Record<MetodoPago, { label: string; cls: string }> = {
  efectivo:      { label: 'Efectivo',      cls: 'bg-teal-50 text-teal-800' },
  transferencia: { label: 'Transferencia', cls: 'bg-blue-50 text-blue-800' },
  debito:        { label: 'Débito',        cls: 'bg-amber-50 text-amber-800' },
  credito:       { label: 'Crédito',       cls: 'bg-pink-50 text-pink-800' },
  mercadopago:   { label: 'Mercado Pago',  cls: 'bg-blue-50 text-blue-800' },
}

const MEDIO_LABEL: Record<string, string> = {
  debit_card:   'Débito',
  credit_card:  'Crédito',
  prepaid_card: 'Prepaga',
  debvisa:      'Visa débito',
  debmaster:    'Master débito',
  visa:         'Visa crédito',
  master:       'Master crédito',
  amex:         'Amex crédito',
}

function Badge({ text, cls }: { text: string; cls: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {text}
    </span>
  )
}

function BadgeEstado({ venta }: { venta: PedidoConTotal }) {
  if (venta.metodo_pago === 'mercadopago' && venta.pendiente > 0) {
    return <Badge text="Pago MP pendiente" cls="bg-orange-50 text-orange-700" />
  }
  if (venta.metodo_pago === 'mercadopago' && venta.pendiente <= 0 && venta.estado === 'entregado') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700">
        <span>✓ Cobrado MP</span>
      </span>
    )
  }
  const cfg = ESTADO_CFG[venta.estado]
  return <Badge text={cfg.label} cls={cfg.cls} />
}

// ── Panel desglose comisiones Point ───────────────────────────

interface PagoPointAsignado {
  mp_pago_id: string
  monto: number
  monto_neto: number
  comisiones: number
  medio: string | null
  cuotas: number
  fecha_pago: string
}

function PanelComisionesPoint({ pedidoId, onCerrar }: {
  pedidoId: number
  onCerrar: () => void
}) {
  const [pago, setPago] = useState<PagoPointAsignado | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('pagos_point_pendientes')
      .select('mp_pago_id, monto, monto_neto, comisiones, medio, cuotas, fecha_pago')
      .eq('pedido_id', pedidoId)
      .eq('estado', 'asignado')
      .order('fecha_pago', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        setPago(data)
        setLoading(false)
      })
  }, [pedidoId])

  const pctComision = pago ? ((pago.comisiones / pago.monto) * 100).toFixed(2) : '0'

  return (
    <tr>
      <td colSpan={9} className="p-0">
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3">
          {loading ? (
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          ) : !pago ? (
            <span className="text-[12px] text-gray-400">No se encontró información del pago Point</span>
          ) : (
            <div className="flex items-start gap-8">

              {/* Desglose */}
              <div className="flex flex-col gap-1.5 min-w-[220px]">
                <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">
                  Desglose pago Point
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-gray-500">Monto cobrado</span>
                  <span className="font-medium text-gray-900">{formatMonto(pago.monto)}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-gray-500">Comisión MP ({pctComision}%)</span>
                  <span className="text-red-600">— {formatMonto(pago.comisiones)}</span>
                </div>
                <div className="flex justify-between text-[12px] pt-1.5 border-t border-gray-200">
                  <span className="font-medium text-gray-700">Neto acreditado</span>
                  <span className="font-medium text-teal-700">{formatMonto(pago.monto_neto)}</span>
                </div>
              </div>

              {/* Info del medio */}
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">
                  Detalle
                </div>
                <div className="text-[12px] text-gray-700">
                  {pago.medio ? (MEDIO_LABEL[pago.medio] ?? pago.medio) : '—'}
                  {pago.cuotas > 1
                    ? ` · ${pago.cuotas} cuotas`
                    : ' · 1 pago'}
                </div>
                <div className="text-[12px] text-gray-500">
                  {formatFecha(pago.fecha_pago)}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  MP #{pago.mp_pago_id}
                </div>
              </div>

              {/* Indicador visual */}
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">
                  Impacto neto
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${(pago.monto_neto / pago.monto) * 100}%` }}
                    />
                  </div>
                  <span className="text-[12px] text-teal-700 font-medium">
                    {((pago.monto_neto / pago.monto) * 100).toFixed(1)}% neto
                  </span>
                </div>
                <div className="text-[11px] text-gray-400">
                  Perdés {formatMonto(pago.comisiones)} en comisiones
                </div>
              </div>

              <button
                onClick={onCerrar}
                className="ml-auto self-start text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1 border border-gray-200 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Modal cobrar ──────────────────────────────────────────────

function ModalCobrar({ venta, onGuardar, onCerrar }: {
  venta: PedidoConTotal
  onGuardar: () => void
  onCerrar: () => void
}) {
  const [monto, setMonto] = useState(venta.pendiente)
  const [metodo, setMetodo] = useState<MetodoPago>(venta.metodo_pago ?? 'efectivo')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleGuardar = async () => {
    if (monto <= 0) { setError('El monto debe ser mayor a 0'); return }
    if (monto > venta.pendiente) { setError(`El máximo es ${formatMonto(venta.pendiente)}`); return }
    setGuardando(true)
    const supabase = createClient()
    try {
      const { error: errPago } = await supabase.from('pagos_pedido').insert({
        pedido_id: venta.id,
        tipo: monto >= venta.pendiente ? 'saldo' : 'adelanto',
        metodo_pago: metodo,
        monto,
        notas: notas.trim() || null,
      })
      if (errPago) throw new Error(errPago.message)
      if (monto >= venta.pendiente && venta.estado !== 'entregado') {
        await supabase.from('pedidos').update({ estado: 'entregado' }).eq('id', venta.id)
      }
      onGuardar()
      onCerrar()
    } catch (e: any) {
      setError(e.message ?? 'Error al registrar el pago')
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Registrar cobro</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {venta.cliente_nombre ?? '(sin cliente)'} · Pedido #{venta.id}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex justify-between text-[12px]">
          <span className="text-amber-800">Saldo pendiente</span>
          <span className="font-medium text-amber-900">{formatMonto(venta.pendiente)}</span>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Monto a cobrar</label>
              <button onClick={() => setMonto(venta.pendiente)}
                className="text-[11px] text-teal-600 hover:underline">Cobrar todo</button>
            </div>
            <input type="number" min={0} max={venta.pendiente} value={monto || ''}
              onChange={e => setMonto(Number(e.target.value))}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
            {monto >= venta.pendiente && (
              <p className="text-[11px] text-teal-600">✓ Cubre el saldo completo — la venta se marcará como entregada</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Método de pago</label>
            <div className="grid grid-cols-4 gap-2">
              {(['efectivo', 'transferencia', 'debito', 'credito'] as MetodoPago[]).map(key => (
                <button key={key} type="button" onClick={() => setMetodo(key)}
                  className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                    metodo === key ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                  }`}>
                  {MP_CFG[key].label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Notas (opcional)</label>
            <input type="text" value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Ej: Pago en efectivo en mano..."
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onCerrar}
            className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando}
            className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : `Registrar ${formatMonto(monto)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal editar ──────────────────────────────────────────────

function ModalEditar({ venta, onGuardar, onCerrar }: {
  venta: PedidoConTotal
  onGuardar: () => void
  onCerrar: () => void
}) {
  const [estado, setEstado] = useState<EstadoPedido>(venta.estado)
  const [canal, setCanal] = useState<CanalVenta>(venta.canal_venta ?? 'directo')
  const [metodo, setMetodo] = useState<MetodoPago>(venta.metodo_pago ?? 'efectivo')
  const [notas, setNotas] = useState(venta.notas ?? '')
  const [fechaEntrega, setFechaEntrega] = useState(venta.fecha_entrega ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleGuardar = async () => {
    setGuardando(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('pedidos').update({
      estado, canal_venta: canal, metodo_pago: metodo,
      notas: notas.trim() || null,
      fecha_entrega: fechaEntrega || null,
      ...(estado === 'entregado' && !venta.fecha_entrega ? { fecha_entrega: new Date().toISOString() } : {}),
    }).eq('id', venta.id)
    if (err) { setError(err.message); setGuardando(false); return }
    onGuardar()
    onCerrar()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Editar venta #{venta.id}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{venta.cliente_nombre ?? '(sin cliente)'} · {formatMonto(venta.total_cobrado)}</p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Estado</label>
            <div className="flex flex-col gap-1.5">
              {(Object.keys(ESTADO_CFG) as EstadoPedido[]).filter(key => key !== 'presupuesto').map(key => (
                <label key={key} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${estado === key ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="estado" checked={estado === key} onChange={() => setEstado(key)} className="flex-shrink-0" />
                  <Badge text={ESTADO_CFG[key].label} cls={ESTADO_CFG[key].cls} />
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Canal de venta</label>
            <select value={canal} onChange={e => setCanal(e.target.value as CanalVenta)}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400">
              <option value="directo">Directo</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="tienda">Tienda</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Método de pago</label>
            <select value={metodo} onChange={e => setMetodo(e.target.value as MetodoPago)}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400">
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Fecha de entrega</label>
            <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-teal-400" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Notas</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Notas internas de la venta..."
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400 resize-none" />
          </div>
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onCerrar} className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando}
            className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card método de pago ───────────────────────────────────────

function MetodoCard({ label, monto, cant, pct, color, activo, onClick }: {
  label: string; monto: number; cant: number; pct: number
  color: string; activo: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className={`text-left p-3 rounded-lg border transition-colors ${activo ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
      <div className="text-[11px] text-gray-400 mb-1">{label}</div>
      <div className="text-[15px] font-medium text-gray-900">{formatMonto(monto)}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">{cant} venta{cant !== 1 ? 's' : ''}</div>
      <div className="h-1 mt-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </button>
  )
}

// ── Modal reenviar link MP ────────────────────────────────────

function ModalReenviarLink({ venta, onCerrar }: { venta: PedidoConTotal; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [link, setLink] = useState<string>(venta.mp_link ?? '')

  const copiar = () => {
    navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const regenerar = async () => {
    setGenerando(true)
    try {
      const res = await fetch('/api/pagos/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: venta.id,
          descripcion: `Pedido #${venta.id}${venta.cliente_nombre ? ` - ${venta.cliente_nombre}` : ''}`,
          monto: venta.pendiente,
          email_cliente: venta.cliente_email ?? undefined,
        }),
      })
      const data = await res.json()
      if (data.link) {
        setLink(data.link)
        const supabase = createClient()
        await supabase.from('pedidos').update({ mp_link: data.link }).eq('id', venta.id)
      }
    } finally { setGenerando(false) }
  }

  const whatsappUrl = `https://wa.me/${
    venta.cliente_telefono ? venta.cliente_telefono.replace(/\D/g, '') : ''
  }?text=${encodeURIComponent(`Hola! Te comparto el link para completar tu pago: ${link}`)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Link de pago MP</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {venta.cliente_nombre ?? '(sin cliente)'} · Pedido #{venta.id} · {formatMonto(venta.pendiente)} pendiente
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input readOnly value={link}
              className="flex-1 text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 truncate" />
            <button onClick={copiar}
              className="px-3 py-1.5 text-[11px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap">
              {copiado ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
          <div className="flex gap-2">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 py-1.5 text-[11px] font-medium text-center bg-green-600 text-white rounded-lg hover:bg-green-700">
              Enviar por WhatsApp
            </a>
            <a href={link} target="_blank" rel="noopener noreferrer"
              className="flex-1 py-1.5 text-[11px] font-medium text-center border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50">
              Abrir link
            </a>
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button onClick={regenerar} disabled={generando}
            className="flex-1 py-1.5 text-[11px] text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {generando ? 'Generando...' : 'Regenerar link'}
          </button>
          <button onClick={onCerrar}
            className="flex-1 py-1.5 text-[11px] font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────

export default function VentasPage() {
  const {
    ventas, resumenMetodos, totalPeriodo, totalCobrado, totalPendiente,
    loading, error, filtros, setFiltros, limpiarFiltros, recargar,
  } = useVentas()

  const [modalCobrar, setModalCobrar] = useState<PedidoConTotal | null>(null)
  const [modalEditar, setModalEditar] = useState<PedidoConTotal | null>(null)
  const [modalAcciones, setModalAcciones] = useState<PedidoConTotal | null>(null)
  const [modalReenviarLink, setModalReenviarLink] = useState<PedidoConTotal | null>(null)
  const [panelComisiones, setPanelComisiones] = useState<number | null>(null)

  // IDs de ventas que tienen pago Point asignado
  const [ventasConPoint, setVentasConPoint] = useState<Set<number>>(new Set())

  const cargarVentasConPoint = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('pagos_point_pendientes')
      .select('pedido_id')
      .eq('estado', 'asignado')
      .not('pedido_id', 'is', null)
    if (data) {
      setVentasConPoint(new Set(data.map((p: any) => p.pedido_id)))
    }
  }, [])

  useEffect(() => { cargarVentasConPoint() }, [cargarVentasConPoint])

  const maxMetodo = Math.max(
    resumenMetodos.efectivo, resumenMetodos.transferencia,
    resumenMetodos.debito, resumenMetodos.credito, 1
  )

  const metodos = [
    { key: 'efectivo'      as MetodoPago, label: 'Efectivo',      color: 'bg-teal-500',  monto: resumenMetodos.efectivo },
    { key: 'transferencia' as MetodoPago, label: 'Transferencia', color: 'bg-blue-500',  monto: resumenMetodos.transferencia },
    { key: 'debito'        as MetodoPago, label: 'Débito +10%',   color: 'bg-amber-500', monto: resumenMetodos.debito },
    { key: 'credito'       as MetodoPago, label: 'Crédito +20%',  color: 'bg-pink-500',  monto: resumenMetodos.credito },
  ]

  if (error) return (
    <div className="p-5">
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
    </div>
  )

  return (
    <div className="p-5 flex flex-col gap-4">

      {modalCobrar && <ModalCobrar venta={modalCobrar} onGuardar={recargar} onCerrar={() => setModalCobrar(null)} />}
      {modalEditar && <ModalEditar venta={modalEditar} onGuardar={recargar} onCerrar={() => setModalEditar(null)} />}
      {modalAcciones && <ModalAccionesVenta venta={modalAcciones} onCompletado={recargar} onCerrar={() => setModalAcciones(null)} />}
      {modalReenviarLink && <ModalReenviarLink venta={modalReenviarLink} onCerrar={() => setModalReenviarLink(null)} />}

      <BannerPagosPoint onAsignado={() => { recargar(); cargarVentasConPoint() }} />

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Ventas</p>
          <h1 className="text-base font-medium text-gray-900">Todas las ventas</h1>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50">
            Exportar CSV
          </button>
          <Link href="/dashboard/ventas/nueva"
            className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            + Nueva venta
          </Link>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total del período', valor: totalPeriodo,   sub: `${ventas.length} ventas` },
          { label: 'Cobrado',           valor: totalCobrado,   sub: totalPeriodo > 0 ? `${Math.round(totalCobrado / totalPeriodo * 100)}% del total` : '—' },
          { label: 'Por cobrar',        valor: totalPendiente, sub: `${ventas.filter(v => v.pendiente > 0).length} ventas con saldo` },
          { label: 'Ticket promedio',   valor: ventas.length > 0 ? Math.round(totalPeriodo / ventas.length) : 0, sub: 'este período' },
        ].map(m => (
          <div key={m.label} className="bg-gray-100 rounded-lg px-4 py-3">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{m.label}</div>
            {loading
              ? <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
              : <div className="text-lg font-medium text-gray-900">{formatMonto(m.valor)}</div>
            }
            <div className="text-[11px] text-gray-400 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Cards método de pago */}
      <div className="grid grid-cols-4 gap-3">
        {metodos.map(m => {
          const cant = ventas.filter(v => v.metodo_pago === m.key).length
          return (
            <MetodoCard key={m.key} label={m.label} monto={m.monto} cant={cant}
              pct={Math.round(m.monto / maxMetodo * 100)} color={m.color}
              activo={filtros.metodo_pago === m.key}
              onClick={() => setFiltros({ metodo_pago: filtros.metodo_pago === m.key ? '' : m.key })} />
          )
        })}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar cliente..."
          value={filtros.busqueda} onChange={e => setFiltros({ busqueda: e.target.value })}
          className="flex-1 min-w-[160px] text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
        <div className="w-px h-5 bg-gray-200" />
        <input type="date" value={filtros.desde} onChange={e => setFiltros({ desde: e.target.value })}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400" />
        <span className="text-xs text-gray-400">→</span>
        <input type="date" value={filtros.hasta} onChange={e => setFiltros({ hasta: e.target.value })}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400" />
        <div className="w-px h-5 bg-gray-200" />
        <select value={filtros.estado} onChange={e => setFiltros({ estado: e.target.value as EstadoPedido | '' })}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400">
          <option value="">Todos los estados</option>
          <option value="confirmado">Confirmadas</option>
          <option value="reservado">Reservadas</option>
          <option value="en_fabricacion">En fabricación</option>
          <option value="entregado">Entregadas</option>
          <option value="cancelado">Canceladas</option>
        </select>
        <select value={filtros.canal_venta} onChange={e => setFiltros({ canal_venta: e.target.value as CanalVenta | '' })}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400">
          <option value="">Todos los canales</option>
          <option value="directo">Directo</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="tienda">Tienda</option>
        </select>
        <button onClick={limpiarFiltros}
          className="ml-auto text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 border border-gray-200 rounded-lg bg-white">
          Limpiar
        </button>
      </div>

      {/* Tabs estado */}
      <div className="flex gap-2 flex-wrap">
        {[
          { val: '',               label: 'Todas' },
          { val: 'confirmado',     label: 'Confirmadas' },
          { val: 'reservado',      label: 'Reservadas' },
          { val: 'en_fabricacion', label: 'En fabricación' },
          { val: 'entregado',      label: 'Entregadas' },
          { val: 'cancelado',      label: 'Canceladas' },
        ].map(tab => {
          const cnt = tab.val ? ventas.filter(v => v.estado === tab.val).length : ventas.length
          return (
            <button key={tab.val}
              onClick={() => setFiltros({ estado: tab.val as EstadoPedido | '' })}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                filtros.estado === tab.val
                  ? 'bg-teal-50 border-teal-500 text-teal-800'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              {tab.label} <span className="opacity-50">({cnt})</span>
            </button>
          )
        })}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-xs text-gray-400">
            {loading ? 'Cargando...' : `${ventas.length} ventas`}
          </span>
          <select className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
            <option>Más recientes primero</option>
            <option>Mayor monto</option>
          </select>
        </div>

        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">#</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Fecha</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Cliente</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Canal</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Método</th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Estado</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Total</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Cobrado / Pendiente</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td colSpan={9} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                    </td>
                  </tr>
                ))
              : ventas.length === 0
                ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-xs text-gray-400">
                      No hay ventas con los filtros seleccionados
                    </td>
                  </tr>
                )
                : ventas.flatMap(v => {
                    const mp = v.metodo_pago ? MP_CFG[v.metodo_pago] : null
                    const esMPPendiente = v.metodo_pago === 'mercadopago' && v.pendiente > 0
                    const tienePoint = ventasConPoint.has(v.id)
                    const panelAbierto = panelComisiones === v.id

                    return [
                      <tr key={v.id} className={`border-t border-gray-100 hover:bg-gray-50 ${panelAbierto ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-2.5 text-gray-400 text-[11px]">#{v.id}</td>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                          {v.fecha_confirmacion ? formatFecha(v.fecha_confirmacion) : formatFecha(v.fecha_pedido)}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {v.cliente_nombre ?? <span className="text-gray-400 font-normal">(sin cliente)</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 capitalize">{v.canal_venta ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {mp ? <Badge text={mp.label} cls={mp.cls} /> : <span className="text-gray-300">—</span>}
                            {tienePoint && (
                              <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                                Point
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><BadgeEstado venta={v} /></td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                          {formatMonto(v.total_cobrado)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {v.pendiente > 0 ? (
                            <div>
                              <span className="text-gray-700">{formatMonto(v.cobrado)}</span>
                              <span className="ml-1.5 text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                -{formatMonto(v.pendiente)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-700">{formatMonto(v.cobrado)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1 justify-end">
                            {tienePoint && (
                              <button
                                onClick={() => setPanelComisiones(prev => prev === v.id ? null : v.id)}
                                className={`text-[11px] px-2.5 py-1 rounded-lg font-medium border transition-colors ${
                                  panelAbierto
                                    ? 'bg-purple-600 text-white border-purple-600'
                                    : 'border-purple-200 text-purple-700 hover:bg-purple-50'
                                }`}
                              >
                                Comisiones
                              </button>
                            )}
                            {esMPPendiente ? (
                              <button onClick={() => setModalReenviarLink(v)}
                                className="text-[11px] px-2.5 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium">
                                Ver link
                              </button>
                            ) : v.pendiente > 0 ? (
                              <button onClick={() => setModalCobrar(v)}
                                className="text-[11px] px-2.5 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
                                Cobrar
                              </button>
                            ) : null}
                            {(v.estado === 'confirmado' || v.estado === 'en_fabricacion' || v.estado === 'entregado') && (
                              <a href={`/api/pdf/remito?id=${v.id}`} target="_blank"
                                className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
                                Remito
                              </a>
                            )}
                            {v.estado === 'entregado' && (
                              <a href={`/api/pdf/ticket?id=${v.id}`} target="_blank"
                                className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
                                Ticket
                              </a>
                            )}
                            <button onClick={() => setModalEditar(v)}
                              className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
                              Editar
                            </button>
                            <button onClick={() => setModalAcciones(v)}
                              className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
                              title="Devolución, cambio o eliminar">
                              ···
                            </button>
                          </div>
                        </td>
                      </tr>,
                      panelAbierto && (
                        <PanelComisionesPoint
                          key={`comisiones-${v.id}`}
                          pedidoId={v.id}
                          onCerrar={() => setPanelComisiones(null)}
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
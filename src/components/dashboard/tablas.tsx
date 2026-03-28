import Link from 'next/link'
import { formatMonto, formatFecha } from '@/lib/utils'
import type { PedidoConTotal, TopProductoMes } from '@/lib/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

const ESTADO_CONFIG = {
  presupuesto:    { label: 'Presupuesto',    cls: 'bg-blue-50 text-blue-800' },
  confirmado:     { label: 'Confirmada',     cls: 'bg-teal-50 text-teal-800' },
  reservado:      { label: 'Reservado',      cls: 'bg-purple-50 text-purple-800' },
  en_fabricacion: { label: 'En fabricación', cls: 'bg-amber-50 text-amber-800' },
  entregado:      { label: 'Entregada',      cls: 'bg-teal-50 text-teal-800' },
  cancelado:      { label: 'Cancelada',      cls: 'bg-gray-100 text-gray-500' },
} as const

function Badge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado as keyof typeof ESTADO_CONFIG] ?? {
    label: estado, cls: 'bg-gray-100 text-gray-500'
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ── Ventas recientes ──────────────────────────────────────────────────────────

interface VentasRecientesProps {
  ventas: PedidoConTotal[]
  loading: boolean
}

export function VentasRecientes({ ventas, loading }: VentasRecientesProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-[13px] font-medium text-gray-900">Ventas recientes</span>
        <Link href="/dashboard/ventas" className="text-[11px] text-teal-600 hover:underline">
          Ver todas →
        </Link>
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Cliente</th>
            <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Estado</th>
            <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Total</th>
            <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Pendiente</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td colSpan={4} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                  </td>
                </tr>
              ))
            : ventas.map((v) => (
                <tr key={v.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900">
                      {v.cliente_nombre ?? '(sin cliente)'}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {formatFecha(v.fecha_pedido)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge estado={v.estado} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    {formatMonto(v.total_cobrado)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {v.pendiente > 0
                      ? <span className="text-amber-700 font-medium">{formatMonto(v.pendiente)}</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                </tr>
              ))
          }
        </tbody>
      </table>
    </div>
  )
}

// ── Top productos ─────────────────────────────────────────────────────────────

interface TopProductosProps {
  productos: TopProductoMes[]
  loading: boolean
}

export function TopProductos({ productos, loading }: TopProductosProps) {
  const maxUnidades = Math.max(...productos.map(p => p.unidades_vendidas), 1)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-[13px] font-medium text-gray-900">Más vendidos del mes</span>
        <Link href="/dashboard/productos" className="text-[11px] text-teal-600 hover:underline">
          Ver catálogo →
        </Link>
      </div>
      <div className="px-4 py-3 space-y-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
            ))
          : productos.map((p) => (
              <div key={p.nombre_producto} className="flex items-center gap-2 text-[12px]">
                <div className="w-28 text-gray-500 truncate flex-shrink-0">
                  {p.nombre_producto}
                </div>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full"
                    style={{ width: `${(p.unidades_vendidas / maxUnidades) * 100}%` }}
                  />
                </div>
                <div className="text-gray-400 w-10 text-right flex-shrink-0">
                  {p.unidades_vendidas} u.
                </div>
              </div>
            ))
        }
      </div>
    </div>
  )
}

// ── Alertas de stock ──────────────────────────────────────────────────────────

interface AlertaStock {
  id: number
  nombre: string
  stock: number
  minimo: number
  unidad: string
  estado_stock: 'bajo' | 'medio'
}

interface AlertasStockProps {
  alertas: AlertaStock[]
  loading: boolean
}

export function AlertasStock({ alertas, loading }: AlertasStockProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-[13px] font-medium text-gray-900">Alertas de stock</span>
        <Link href="/dashboard/insumos" className="text-[11px] text-teal-600 hover:underline">
          Ver insumos →
        </Link>
      </div>
      <div className="divide-y divide-gray-100">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
              </div>
            ))
          : alertas.length === 0
            ? (
              <div className="px-4 py-6 text-center text-[12px] text-gray-400">
                Todo el stock en orden
              </div>
            )
            : alertas.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      a.estado_stock === 'bajo' ? 'bg-red-400' : 'bg-amber-400'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="text-[12px] font-medium text-gray-900">{a.nombre}</div>
                    <div className="text-[11px] text-gray-400">
                      {a.stock} {a.unidad} — mínimo {a.minimo}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      a.estado_stock === 'bajo'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {a.estado_stock === 'bajo' ? 'Bajo' : 'Medio'}
                  </span>
                </div>
              ))
        }
      </div>
    </div>
  )
}

// ── Fabricación pendiente ─────────────────────────────────────────────────────

interface FabricacionItem {
  id: number
  cliente_nombre: string
  cliente_telefono: string
  notas: string
  fecha_compromiso_fabricacion: string
  dias_restantes: number
  estado_plazo: 'llegó' | 'retrasado' | 'vence hoy' | 'en plazo'
}

interface FabricacionProps {
  items: FabricacionItem[]
  loading: boolean
}

const PLAZO_CONFIG = {
  'retrasado':  { cls: 'bg-red-50 text-red-700',    label: 'Retrasado' },
  'vence hoy':  { cls: 'bg-red-50 text-red-700',    label: 'Vence hoy' },
  'en plazo':   { cls: 'bg-teal-50 text-teal-700',  label: 'En plazo' },
  'llegó':      { cls: 'bg-gray-100 text-gray-500', label: 'Llegó' },
} as const

export function FabricacionPendiente({ items, loading }: FabricacionProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-[13px] font-medium text-gray-900">Encargos en fabricación</span>
        <Link href="/dashboard/ventas" className="text-[11px] text-teal-600 hover:underline">
          Ver ventas →
        </Link>
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Cliente</th>
            <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Vence</th>
            <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Estado</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td colSpan={3} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                  </td>
                </tr>
              ))
            : items.length === 0
              ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-[12px] text-gray-400">
                    Sin encargos activos
                  </td>
                </tr>
              )
              : items.map((item) => {
                  const plazo = PLAZO_CONFIG[item.estado_plazo] ?? PLAZO_CONFIG['en plazo']
                  return (
                    <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900">{item.cliente_nombre}</div>
                        {item.notas && (
                          <div className="text-[11px] text-gray-400 truncate max-w-[160px]">
                            {item.notas}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {item.fecha_compromiso_fabricacion
                          ? formatFecha(item.fecha_compromiso_fabricacion)
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${plazo.cls}`}>
                          {plazo.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
          }
        </tbody>
      </table>
    </div>
  )
}
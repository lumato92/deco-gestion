'use client'

// src/app/dashboard/page.tsx

import Link from 'next/link'
import { useDashboard } from '@/hooks/use-dashboard'
import { formatMonto, formatFecha } from '@/lib/utils'

const ESTADO_CONFIG = {
  presupuesto:    { label: 'Presupuesto',    cls: 'bg-blue-50 text-blue-800' },
  confirmado:     { label: 'Confirmada',     cls: 'bg-teal-50 text-teal-800' },
  reservado:      { label: 'Reservado',      cls: 'bg-purple-50 text-purple-800' },
  en_fabricacion: { label: 'En fabricación', cls: 'bg-amber-50 text-amber-800' },
  entregado:      { label: 'Entregada',      cls: 'bg-teal-50 text-teal-800' },
  cancelado:      { label: 'Cancelada',      cls: 'bg-gray-100 text-gray-500' },
} as const

const MEDIO_LABEL: Record<string, string> = {
  debit_card: 'Débito', credit_card: 'Crédito', prepaid_card: 'Prepaga',
  debvisa: 'Visa débito', debmaster: 'Master débito',
  visa: 'Visa crédito', master: 'Master crédito', amex: 'Amex',
}

const PLAZO_CONFIG = {
  'retrasado':  { cls: 'bg-red-50 text-red-700',    label: 'Retrasado' },
  'vence hoy':  { cls: 'bg-red-50 text-red-700',    label: 'Vence hoy' },
  'en plazo':   { cls: 'bg-teal-50 text-teal-700',  label: 'En plazo' },
  'llegó':      { cls: 'bg-gray-100 text-gray-500', label: 'Llegó' },
} as const

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>{text}</span>
}

function Skeleton({ w = 'w-24' }: { w?: string }) {
  return <div className={`h-5 ${w} bg-gray-200 rounded animate-pulse`} />
}

export default function DashboardPage() {
  const {
    resumen, ventasRecientes, topProductos, alertasStock,
    fabricacionPendiente, pagosPointPendientes, balanceMP,
    presupuestosSinConfirmar, loading, error, recargar,
  } = useDashboard()

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
    </div>
  )

  const fecha = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const margenPct = resumen && resumen.ingresos > 0
    ? Math.round(resumen.ganancia_bruta / resumen.ingresos * 100)
    : 0

  const totalPointPendiente = pagosPointPendientes.reduce((s, p) => s + p.monto, 0)

  return (
    <div className="p-5 flex flex-col gap-4">

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Dashboard</p>
          <h1 className="text-base font-medium text-gray-900 capitalize">{fecha}</h1>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={recargar}
            className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50">
            ↻
          </button>
          <Link href="/dashboard/ventas/presupuestos/nuevo"
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50">
            + Presupuesto
          </Link>
          <Link href="/dashboard/ventas/nueva"
            className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            + Nueva venta
          </Link>
        </div>
      </div>

      {/* ── Fila 1: Métricas financieras ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: 'Ingresos del mes',
            valor: resumen?.ingresos ?? 0,
            sub: `${resumen?.cant_pedidos ?? 0} ventas`,
            color: 'text-gray-900',
            icon: '↑',
            iconCls: 'text-teal-500',
          },
          {
            label: 'Gastos del mes',
            valor: resumen?.total_gastos ?? 0,
            sub: 'operativos registrados',
            color: 'text-gray-900',
            icon: '↓',
            iconCls: 'text-red-400',
          },
          {
            label: 'Ganancia bruta',
            valor: resumen?.ganancia_bruta ?? 0,
            sub: `${margenPct}% de margen`,
            color: margenPct >= 30 ? 'text-teal-700' : margenPct >= 15 ? 'text-amber-700' : 'text-red-600',
            icon: '◈',
            iconCls: 'text-gray-400',
          },
          {
            label: 'Resultado neto',
            valor: resumen?.resultado_neto ?? 0,
            sub: (resumen?.resultado_neto ?? 0) >= 0 ? '↑ positivo' : '↓ negativo',
            color: (resumen?.resultado_neto ?? 0) >= 0 ? 'text-teal-700' : 'text-red-600',
            icon: '=',
            iconCls: 'text-gray-400',
          },
        ].map(m => (
          <div key={m.label} className="bg-gray-100 rounded-lg px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`text-[11px] font-bold ${m.iconCls}`}>{m.icon}</span>
              <span className="text-[11px] text-gray-400 uppercase tracking-wide">{m.label}</span>
            </div>
            {loading ? <Skeleton w="w-28" /> : (
              <div className={`text-xl font-medium ${m.color}`}>{formatMonto(m.valor)}</div>
            )}
            <div className="text-[11px] text-gray-400 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Fila 2: Balance MP + Pagos Point pendientes + Presupuestos ── */}
      <div className="grid grid-cols-3 gap-3">

        {/* Balance MP */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-gray-900">Balance Mercado Pago</span>
            <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">En tiempo real</span>
          </div>
          {loading || !balanceMP ? (
            <div className="flex flex-col gap-2">
              <Skeleton w="w-32" /><Skeleton w="w-24" />
            </div>
          ) : (
            <>
              <div>
                <div className="text-[11px] text-gray-400 mb-0.5">Disponible para usar</div>
                <div className="text-2xl font-medium text-teal-700">{formatMonto(balanceMP.available_balance)}</div>
              </div>
              <div className="flex justify-between text-[12px] pt-2 border-t border-gray-100">
                <div>
                  <div className="text-gray-400">En proceso</div>
                  <div className="font-medium text-amber-700">{formatMonto(balanceMP.unavailable_balance)}</div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400">Total en cuenta</div>
                  <div className="font-medium text-gray-900">{formatMonto(balanceMP.total_amount)}</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pagos Point pendientes */}
        <div className={`rounded-xl border p-4 flex flex-col gap-3 ${pagosPointPendientes.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-gray-900">Pagos Point sin asignar</span>
            <Link href="/dashboard/ventas" className="text-[11px] text-teal-600 hover:underline">
              Ir a ventas →
            </Link>
          </div>
          {loading ? <Skeleton /> : pagosPointPendientes.length === 0 ? (
            <div className="flex items-center gap-2 text-[12px] text-gray-400">
              <span className="text-teal-500">✓</span> Todo asignado
            </div>
          ) : (
            <>
              <div>
                <div className="text-[11px] text-amber-700 mb-0.5">
                  {pagosPointPendientes.length} pago{pagosPointPendientes.length > 1 ? 's' : ''} pendiente{pagosPointPendientes.length > 1 ? 's' : ''}
                </div>
                <div className="text-2xl font-medium text-amber-900">{formatMonto(totalPointPendiente)}</div>
              </div>
              <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto">
                {pagosPointPendientes.map(p => (
                  <div key={p.id} className="flex justify-between text-[11px]">
                    <span className="text-gray-600">
                      {p.medio ? (MEDIO_LABEL[p.medio] ?? p.medio) : '—'}
                      {p.cuotas > 1 ? ` · ${p.cuotas}c` : ''}
                    </span>
                    <span className="font-medium text-gray-900">{formatMonto(p.monto)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Presupuestos sin confirmar */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-gray-900">Presupuestos abiertos</span>
            <Link href="/dashboard/ventas/presupuestos" className="text-[11px] text-teal-600 hover:underline">
              Ver todos →
            </Link>
          </div>
          {loading ? <Skeleton /> : presupuestosSinConfirmar.length === 0 ? (
            <div className="text-[12px] text-gray-400">Sin presupuestos pendientes</div>
          ) : (
            <div className="flex flex-col gap-2">
              {presupuestosSinConfirmar.map(p => (
                <div key={p.id} className="flex items-center justify-between text-[12px]">
                  <div>
                    <span className="font-medium text-gray-900">{p.cliente_nombre ?? '(sin cliente)'}</span>
                    <span className="ml-1.5 text-[11px] text-gray-400">#{p.id}</span>
                  </div>
                  <span className="font-medium text-gray-700">{formatMonto(p.total_cobrado)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Fila 3: Últimas ventas + Top productos ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Últimas 5 ventas */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-[13px] font-medium text-gray-900">Últimas ventas</span>
            <Link href="/dashboard/ventas" className="text-[11px] text-teal-600 hover:underline">Ver todas →</Link>
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
                      <td colSpan={4} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" /></td>
                    </tr>
                  ))
                : ventasRecientes.length === 0
                  ? <tr><td colSpan={4} className="px-4 py-6 text-center text-[12px] text-gray-400">Sin ventas recientes</td></tr>
                  : ventasRecientes.map(v => {
                      const cfg = ESTADO_CONFIG[v.estado as keyof typeof ESTADO_CONFIG]
                      return (
                        <tr key={v.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-900">{v.cliente_nombre ?? '(sin cliente)'}</div>
                            <div className="text-[11px] text-gray-400">{formatFecha(v.fecha_pedido)}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge text={cfg?.label ?? v.estado} cls={cfg?.cls ?? 'bg-gray-100 text-gray-500'} />
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900">{formatMonto(v.total_cobrado)}</td>
                          <td className="px-4 py-2.5 text-right">
                            {v.pendiente > 0
                              ? <span className="text-amber-700 font-medium">{formatMonto(v.pendiente)}</span>
                              : <span className="text-gray-300">—</span>
                            }
                          </td>
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>
        </div>

        {/* Top 5 productos */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-[13px] font-medium text-gray-900">Más vendidos del mes</span>
            <Link href="/dashboard/productos" className="text-[11px] text-teal-600 hover:underline">Ver catálogo →</Link>
          </div>
          <div className="px-4 py-3 flex flex-col gap-3">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />)
              : topProductos.length === 0
                ? <div className="text-[12px] text-gray-400 py-4 text-center">Sin datos este mes</div>
                : (() => {
                    const max = Math.max(...topProductos.map(p => p.unidades_vendidas), 1)
                    return topProductos.map((p, i) => (
                      <div key={p.nombre_producto} className="flex items-center gap-2 text-[12px]">
                        <span className="text-[11px] text-gray-300 w-4 flex-shrink-0">{i + 1}</span>
                        <div className="w-32 text-gray-700 truncate flex-shrink-0 font-medium">{p.nombre_producto}</div>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(p.unidades_vendidas / max) * 100}%` }} />
                        </div>
                        <div className="text-gray-400 w-12 text-right flex-shrink-0">{p.unidades_vendidas} u.</div>
                      </div>
                    ))
                  })()
            }
          </div>
        </div>
      </div>

      {/* ── Fila 4: Alertas stock + Fabricación + Pagos Point detalle ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Alertas de stock */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-[13px] font-medium text-gray-900">Alertas de stock</span>
            <Link href="/dashboard/insumos" className="text-[11px] text-teal-600 hover:underline">Ver insumos →</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" /></div>
                ))
              : alertasStock.length === 0
                ? <div className="px-4 py-6 text-center text-[12px] text-gray-400">✓ Todo el stock en orden</div>
                : alertasStock.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.estado_stock === 'bajo' ? 'bg-red-400' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-gray-900 truncate">{a.nombre}</div>
                        <div className="text-[11px] text-gray-400">{a.stock} {a.unidad} — mín {a.minimo}</div>
                      </div>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${a.estado_stock === 'bajo' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                        {a.estado_stock === 'bajo' ? 'Bajo' : 'Medio'}
                      </span>
                    </div>
                  ))
            }
          </div>
        </div>

        {/* Fabricación pendiente */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-[13px] font-medium text-gray-900">Encargos en fabricación</span>
            <Link href="/dashboard/ventas" className="text-[11px] text-teal-600 hover:underline">Ver ventas →</Link>
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
                      <td colSpan={3} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" /></td>
                    </tr>
                  ))
                : fabricacionPendiente.length === 0
                  ? <tr><td colSpan={3} className="px-4 py-6 text-center text-[12px] text-gray-400">Sin encargos activos</td></tr>
                  : fabricacionPendiente.map(item => {
                      const plazo = PLAZO_CONFIG[item.estado_plazo] ?? PLAZO_CONFIG['en plazo']
                      return (
                        <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-900">{item.cliente_nombre}</div>
                            {item.notas && <div className="text-[11px] text-gray-400 truncate max-w-[120px]">{item.notas}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">
                            {item.fecha_compromiso_fabricacion ? formatFecha(item.fecha_compromiso_fabricacion) : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${plazo.cls}`}>{plazo.label}</span>
                          </td>
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>
        </div>

        {/* Pagos Point pendientes detalle */}
        <div className={`rounded-xl border overflow-hidden ${pagosPointPendientes.length > 0 ? 'border-amber-200' : 'border-gray-200'}`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${pagosPointPendientes.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-100'}`}>
            <span className="text-[13px] font-medium text-gray-900">Pagos Point pendientes</span>
            <Link href="/dashboard/ventas" className="text-[11px] text-teal-600 hover:underline">Asignar →</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" /></div>
                ))
              : pagosPointPendientes.length === 0
                ? <div className="px-4 py-6 text-center text-[12px] text-gray-400">✓ Sin pagos pendientes</div>
                : pagosPointPendientes.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <div className="text-[12px] font-medium text-gray-900">{formatMonto(p.monto)}</div>
                        <div className="text-[11px] text-gray-400">
                          {p.medio ? (MEDIO_LABEL[p.medio] ?? p.medio) : '—'}
                          {p.cuotas > 1 ? ` · ${p.cuotas} cuotas` : ''}
                          {' · '}{formatFecha(p.fecha_pago)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-teal-700 font-medium">{formatMonto(p.monto_neto)}</div>
                        <div className="text-[10px] text-red-500">-{formatMonto(p.comisiones)}</div>
                      </div>
                    </div>
                  ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}
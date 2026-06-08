'use client'

// src/app/dashboard/finanzas/page.tsx

import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { useFinanzas } from '@/hooks/use-finanzas'
import { formatMonto } from '@/lib/utils'

// ── Colores ───────────────────────────────────────────────────

const MP_COLORES: Record<string, { label: string; color: string; cls: string }> = {
  efectivo:      { label: 'Efectivo',      color: '#0F6E56', cls: 'bg-teal-600' },
  transferencia: { label: 'Transferencia', color: '#185FA5', cls: 'bg-blue-600' },
  debito:        { label: 'Débito',        color: '#854F0B', cls: 'bg-amber-700' },
  credito:       { label: 'Crédito',       color: '#993556', cls: 'bg-pink-700' },
}

const CAT_COLORES: Record<string, string> = {
  Fijo:        '#185FA5',
  Insumos:     '#27500A',
  Flete:       '#854F0B',
  Honorarios:  '#3C3489',
  Publicidad:  '#993556',
  Varios:      '#6B7280',
}

const CANAL_CFG: Record<string, { label: string; color: string }> = {
  directo:    { label: 'Directo',    color: '#0F6E56' },
  whatsapp:   { label: 'WhatsApp',   color: '#25D366' },
  instagram:  { label: 'Instagram',  color: '#993556' },
  tienda:     { label: 'Tienda',     color: '#185FA5' },
  'sin canal':{ label: 'Sin canal',  color: '#9CA3AF' },
}

// ── Tooltip personalizado ─────────────────────────────────────

function TooltipCustom({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-[12px]">
      <div className="font-medium text-gray-900 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-medium text-gray-900">{formatMonto(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Métrica card ─────────────────────────────────────────────

function MetricaCard({ label, valor, sub, color, loading }: {
  label: string; valor: number; sub: string
  color?: string; loading: boolean
}) {
  return (
    <div className="bg-gray-100 rounded-lg px-4 py-3">
      <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      {loading
        ? <div className="h-7 w-24 bg-gray-200 rounded animate-pulse" />
        : <div className={`text-xl font-medium ${color ?? 'text-gray-900'}`}>
            {formatMonto(valor)}
          </div>
      }
      <div className="text-[11px] text-gray-400 mt-1">{sub}</div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────

export default function FinanzasPage() {
  const {
    mesActual, historico, desglosePagos, desgloseGastos, topClientes,
    topProductos, ventasPorCanal, pedidosConPerdida,
    cuentasPorCobrar, inventario, flujoFondos,
    mesSeleccionado, setMesSeleccionado, mesesDisponibles,
    loading, error,
  } = useFinanzas()

  const [ordenProd, setOrdenProd] = useState<'facturacion' | 'margen' | 'unidades'>('facturacion')

  if (error) return (
    <div className="p-5">
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
    </div>
  )

  const resultadoPositivo = (mesActual?.resultado_neto ?? 0) >= 0

  const productosOrdenados = [...topProductos]
    .sort((a, b) => {
      if (ordenProd === 'margen') return b.margen - a.margen
      if (ordenProd === 'unidades') return b.unidades - a.unidades
      return b.facturacion - a.facturacion
    })
    .slice(0, 8)

  // Navegación entre meses (mesesDisponibles está ordenado del más nuevo al más viejo)
  const idxMes = mesesDisponibles.findIndex(m => m.value === mesSeleccionado)
  const hayAnterior = idxMes < mesesDisponibles.length - 1
  const haySiguiente = idxMes > 0
  const [anioSel, mesNumSel] = mesSeleccionado.split('-')

  return (
    <div className="p-5 flex flex-col gap-4">

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Negocio</p>
          <h1 className="text-base font-medium text-gray-900">Finanzas</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Selector de mes */}
          <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden">
            <button
              onClick={() => hayAnterior && setMesSeleccionado(mesesDisponibles[idxMes + 1].value)}
              disabled={!hayAnterior}
              className="px-2 py-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <select
              value={mesSeleccionado}
              onChange={e => setMesSeleccionado(e.target.value)}
              className="text-xs font-medium text-gray-700 px-2 py-1.5 border-x border-gray-200 focus:outline-none capitalize bg-white min-w-[120px] text-center"
            >
              {mesesDisponibles.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <button
              onClick={() => haySiguiente && setMesSeleccionado(mesesDisponibles[idxMes - 1].value)}
              disabled={!haySiguiente}
              className="px-2 py-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>
          <a
            href={`/api/pdf/financiero?mes=${parseInt(mesNumSel)}&anio=${anioSel}`}
            target="_blank"
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50"
          >
            Exportar PDF
          </a>
        </div>
      </div>

      {/* Métricas del mes */}
      <div className="grid grid-cols-5 gap-3">
        <MetricaCard label="Ingresos"       valor={mesActual?.ingresos ?? 0}       sub={`${mesActual?.cant_pedidos ?? 0} ventas`}        loading={loading} />
        <MetricaCard label="Ganancia bruta" valor={mesActual?.ganancia_bruta ?? 0} sub={`${mesActual?.margen_pct ?? 0}% de margen`}      loading={loading} />
        <MetricaCard label="Gastos"         valor={mesActual?.total_gastos ?? 0}   sub="operativos del mes"                              loading={loading} />
        <MetricaCard
          label="Resultado neto"
          valor={mesActual?.resultado_neto ?? 0}
          sub={resultadoPositivo ? 'positivo' : 'negativo'}
          color={resultadoPositivo ? 'text-teal-700' : 'text-red-600'}
          loading={loading}
        />
        <div className="bg-gray-100 rounded-lg px-4 py-3">
          <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Margen</div>
          {loading
            ? <div className="h-7 w-16 bg-gray-200 rounded animate-pulse" />
            : (
              <div className={`text-xl font-medium ${
                (mesActual?.margen_pct ?? 0) >= 40 ? 'text-teal-700'
                : (mesActual?.margen_pct ?? 0) >= 20 ? 'text-amber-700'
                : 'text-red-600'
              }`}>
                {mesActual?.margen_pct ?? 0}%
              </div>
            )
          }
          <div className="text-[11px] text-gray-400 mt-1">ganancia / ingresos</div>
        </div>
      </div>

      {/* Gráfico histórico — área */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-[13px] font-medium text-gray-900 mb-4">Evolución últimos 6 meses</div>
        {loading ? (
          <div className="h-48 bg-gray-50 rounded-lg animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={historico} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0F6E56" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0F6E56" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradGanancia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#185FA5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#185FA5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="mes_label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${Math.round(v / 1000)}k`} />
              <Tooltip content={<TooltipCustom />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="ingresos" name="Ingresos"
                stroke="#0F6E56" fill="url(#gradIngresos)" strokeWidth={2} dot={{ r: 3, fill: '#0F6E56' }} />
              <Area type="monotone" dataKey="ganancia_bruta" name="Ganancia bruta"
                stroke="#185FA5" fill="url(#gradGanancia)" strokeWidth={2} dot={{ r: 3, fill: '#185FA5' }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Fila: gastos vs ingresos + desglose métodos */}
      <div className="grid grid-cols-2 gap-4">

        {/* Gráfico de barras ingresos vs gastos */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[13px] font-medium text-gray-900 mb-4">Ingresos vs Gastos</div>
          {loading ? (
            <div className="h-40 bg-gray-50 rounded-lg animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={historico} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="mes_label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `$${Math.round(v / 1000)}k`} />
                <Tooltip content={<TooltipCustom />} />
                <Bar dataKey="ingresos"     name="Ingresos" fill="#0F6E56" radius={[3, 3, 0, 0]} />
                <Bar dataKey="total_gastos" name="Gastos"   fill="#F87171" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Desglose métodos de pago */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[13px] font-medium text-gray-900 mb-4">Ingresos por método de pago</div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : desglosePagos.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">Sin datos del mes</div>
          ) : (
            <div className="flex flex-col gap-3">
              {desglosePagos.map(mp => {
                const cfg = MP_COLORES[mp.metodo] ?? { label: mp.metodo, color: '#6B7280', cls: 'bg-gray-500' }
                return (
                  <div key={mp.metodo}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${cfg.cls}`} />
                        <span className="text-[12px] text-gray-700">{cfg.label}</span>
                        <span className="text-[11px] text-gray-400">{mp.cant} cobro{mp.cant !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400">{mp.pct}%</span>
                        <span className="text-[12px] font-medium text-gray-900">{formatMonto(mp.total)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.cls}`} style={{ width: `${mp.pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fila: resultado neto histórico + gastos por categoría + top clientes */}
      <div className="grid grid-cols-3 gap-4">

        {/* Resultado neto */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[13px] font-medium text-gray-900 mb-4">Resultado neto</div>
          {loading ? (
            <div className="h-36 bg-gray-50 rounded-lg animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={historico} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="mes_label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `$${Math.round(v / 1000)}k`} />
                <Tooltip content={<TooltipCustom />} />
                <Bar dataKey="resultado_neto" name="Resultado"
                  radius={[3, 3, 0, 0]}
                  label={false}
                >
                  {historico.map((entry, i) => (
                    <Cell key={i} fill={entry.resultado_neto >= 0 ? '#0F6E56' : '#F87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Gastos por categoría */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[13px] font-medium text-gray-900 mb-4">Gastos del mes por categoría</div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : desgloseGastos.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">Sin gastos este mes</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {desgloseGastos.map(g => (
                <div key={g.categoria}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-gray-700">{g.categoria}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400">{g.pct}%</span>
                      <span className="text-[12px] font-medium text-gray-900">{formatMonto(g.total)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${g.pct}%`, background: CAT_COLORES[g.categoria] ?? '#6B7280' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top clientes */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[13px] font-medium text-gray-900 mb-4">Top clientes del mes</div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : topClientes.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">Sin ventas identificadas este mes</div>
          ) : (
            <div className="flex flex-col gap-0 divide-y divide-gray-100">
              {topClientes.map((c, i) => (
                <div key={c.cliente_nombre} className="flex items-center gap-3 py-2.5">
                  <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-500 flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-gray-900 truncate">{c.cliente_nombre}</div>
                    <div className="text-[11px] text-gray-400">{c.cant_pedidos} compra{c.cant_pedidos !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-[12px] font-medium text-gray-900 flex-shrink-0">
                    {formatMonto(c.total_compras)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tesorería: cuentas por cobrar · caja vs banco · inventario */}
      <div className="grid grid-cols-3 gap-4">

        {/* Cuentas por cobrar */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-medium text-gray-900">Cuentas por cobrar</div>
            <span className="text-[10px] text-gray-400">al día de hoy</span>
          </div>
          {loading ? (
            <div className="h-28 bg-gray-50 rounded-lg animate-pulse" />
          ) : (
            <>
              <div className="text-xl font-medium text-gray-900">{formatMonto(cuentasPorCobrar.total)}</div>
              <div className="text-[11px] text-gray-400 mt-1 mb-3">
                {cuentasPorCobrar.cantidad} pedido{cuentasPorCobrar.cantidad !== 1 ? 's' : ''} con saldo
              </div>
              {cuentasPorCobrar.total > 0 && (
                <div className="flex flex-col gap-1.5">
                  {([
                    { k: 'reciente', label: '0–30 días',  val: cuentasPorCobrar.aging.reciente, cls: 'text-teal-700' },
                    { k: 'medio',    label: '31–60 días', val: cuentasPorCobrar.aging.medio,    cls: 'text-amber-700' },
                    { k: 'vencido',  label: '+60 días',   val: cuentasPorCobrar.aging.vencido,  cls: 'text-red-600' },
                  ] as const).map(b => (
                    <div key={b.k} className="flex items-center justify-between text-[12px]">
                      <span className="text-gray-500">{b.label}</span>
                      <span className={`font-medium ${b.val > 0 ? b.cls : 'text-gray-400'}`}>{formatMonto(b.val)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Caja vs Banco */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[13px] font-medium text-gray-900 mb-3">Flujo de fondos del mes</div>
          {loading ? (
            <div className="h-28 bg-gray-50 rounded-lg animate-pulse" />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {([
                { label: 'Caja',  hint: 'efectivo', f: flujoFondos.caja },
                { label: 'Banco', hint: 'transf./tarjetas/MP', f: flujoFondos.banco },
              ] as const).map(c => (
                <div key={c.label} className="border border-gray-100 rounded-lg p-3">
                  <div className="text-[12px] font-medium text-gray-700">{c.label}</div>
                  <div className="text-[10px] text-gray-400 mb-2">{c.hint}</div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-gray-500">Entró</span>
                    <span className="text-teal-700 font-medium">{formatMonto(c.f.entra)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-gray-500">Salió</span>
                    <span className="text-red-600 font-medium">{formatMonto(c.f.sale)}</span>
                  </div>
                  <div className="flex justify-between text-[12px] pt-1.5 border-t border-gray-100">
                    <span className="text-gray-600">Neto</span>
                    <span className={`font-medium ${c.f.neto >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
                      {c.f.neto >= 0 ? '' : '−'}{formatMonto(Math.abs(c.f.neto))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Valor de inventario */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-medium text-gray-900">Valor de inventario</div>
            <span className="text-[10px] text-gray-400">al día de hoy</span>
          </div>
          {loading ? (
            <div className="h-28 bg-gray-50 rounded-lg animate-pulse" />
          ) : (
            <>
              <div className="text-xl font-medium text-gray-900">{formatMonto(inventario.valor)}</div>
              <div className="text-[11px] text-gray-400 mt-1">capital inmovilizado en stock</div>
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
                <div>
                  <div className="text-[15px] font-medium text-gray-900">{inventario.unidades}</div>
                  <div className="text-[11px] text-gray-400">unidades</div>
                </div>
                <div>
                  <div className="text-[15px] font-medium text-gray-900">{inventario.productos}</div>
                  <div className="text-[11px] text-gray-400">productos activos</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pedidos con pérdida */}
      {!loading && pedidosConPerdida.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-medium text-red-800">
              ⚠ Pedidos con pérdida ({pedidosConPerdida.length})
            </span>
            <span className="text-[11px] text-red-600">vendidos por debajo del costo</span>
          </div>
          <div className="flex flex-col divide-y divide-red-100">
            {pedidosConPerdida.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 text-[12px]">
                <span className="text-gray-700">#{p.id} · {p.cliente_nombre ?? '(sin cliente)'}</span>
                <div className="flex items-center gap-4">
                  <span className="text-gray-500">{formatMonto(p.total_cobrado)}</span>
                  <span className="font-medium text-red-600">{formatMonto(p.ganancia)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fila: top productos + ventas por canal */}
      <div className="grid grid-cols-3 gap-4">

        {/* Top productos */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] font-medium text-gray-900">Top productos del mes</div>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setOrdenProd('facturacion')}
                className={`px-2.5 py-1 text-[11px] font-medium ${ordenProd === 'facturacion' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>
                Facturación
              </button>
              <button onClick={() => setOrdenProd('margen')}
                className={`px-2.5 py-1 text-[11px] font-medium border-l border-gray-200 ${ordenProd === 'margen' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>
                Margen
              </button>
              <button onClick={() => setOrdenProd('unidades')}
                className={`px-2.5 py-1 text-[11px] font-medium border-l border-gray-200 ${ordenProd === 'unidades' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>
                Cantidad
              </button>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-7 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : productosOrdenados.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">Sin ventas este mes</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-2 text-[11px] font-medium text-gray-400">Producto</th>
                  <th className="text-right pb-2 text-[11px] font-medium text-gray-400 w-16">Unid.</th>
                  <th className="text-right pb-2 text-[11px] font-medium text-gray-400 w-28">Facturación</th>
                  <th className="text-right pb-2 text-[11px] font-medium text-gray-400 w-32">Margen</th>
                </tr>
              </thead>
              <tbody>
                {productosOrdenados.map(p => (
                  <tr key={p.clave} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 font-medium text-gray-900">{p.nombre}</td>
                    <td className="py-2 text-right text-gray-600">{p.unidades}</td>
                    <td className="py-2 text-right font-medium text-gray-900">{formatMonto(p.facturacion)}</td>
                    <td className="py-2 text-right">
                      <span className="font-medium text-gray-900">{formatMonto(p.margen)}</span>
                      <span className={`ml-1.5 text-[11px] ${p.margen_pct >= 40 ? 'text-teal-700' : p.margen_pct >= 20 ? 'text-amber-700' : 'text-red-600'}`}>
                        {p.margen_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Ventas por canal */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[13px] font-medium text-gray-900 mb-4">Ventas por canal</div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : ventasPorCanal.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">Sin ventas este mes</div>
          ) : (
            <div className="flex flex-col gap-3">
              {ventasPorCanal.map(c => {
                const cfg = CANAL_CFG[c.canal] ?? { label: c.canal, color: '#6B7280' }
                return (
                  <div key={c.canal}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                        <span className="text-[12px] text-gray-700 capitalize">{cfg.label}</span>
                        <span className="text-[11px] text-gray-400">{c.cant} venta{c.cant !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400">{c.pct}%</span>
                        <span className="text-[12px] font-medium text-gray-900">{formatMonto(c.total)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: cfg.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tabla resumen histórico */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="text-[13px] font-medium text-gray-900">Resumen por mes</span>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-gray-400">Mes</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Ventas</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Ingresos</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Ganancia bruta</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Gastos</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Resultado neto</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-gray-400">Margen</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                    </td>
                  </tr>
                ))
              : [...historico].reverse().map((m, i) => {
                  const margen = m.ingresos > 0
                    ? Math.round(m.ganancia_bruta / m.ingresos * 100)
                    : 0
                  const esActual = i === 0
                  return (
                    <tr key={m.mes} className={`border-t border-gray-100 ${esActual ? 'bg-teal-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        {m.mes_label} {m.mes.split('-')[0]}
                        {esActual && (
                          <span className="ml-2 text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">
                            actual
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{m.cant_pedidos}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">{formatMonto(m.ingresos)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{formatMonto(m.ganancia_bruta)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{formatMonto(m.total_gastos)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${m.resultado_neto >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
                        {m.resultado_neto >= 0 ? '' : '−'}{formatMonto(Math.abs(m.resultado_neto))}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-medium ${margen >= 40 ? 'text-teal-700' : margen >= 20 ? 'text-amber-700' : 'text-red-600'}`}>
                        {margen}%
                      </td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
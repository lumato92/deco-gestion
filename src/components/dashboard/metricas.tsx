import { formatMonto } from '@/lib/utils'
import type { ResumenFinancieroMes } from '@/lib/types'

interface Props {
  resumen: ResumenFinancieroMes | null
  loading: boolean
}

export function MetricasDashboard({ resumen, loading }: Props) {
  const metricas = [
    {
      label: 'Ingresos del mes',
      valor: resumen?.ingresos ?? 0,
      sub: `${resumen?.cant_pedidos ?? 0} ventas`,
      color: 'text-gray-900',
    },
    {
      label: 'Ganancia bruta',
      valor: resumen?.ganancia_bruta ?? 0,
      sub: resumen && resumen.ingresos > 0
        ? `${Math.round(resumen.ganancia_bruta / resumen.ingresos * 100)}% de margen`
        : '—',
      color: 'text-gray-900',
    },
    {
      label: 'Gastos operativos',
      valor: resumen?.total_gastos ?? 0,
      sub: 'del mes en curso',
      color: 'text-gray-900',
    },
    {
      label: 'Resultado neto',
      valor: resumen?.resultado_neto ?? 0,
      sub: (resumen?.resultado_neto ?? 0) >= 0 ? 'positivo' : 'negativo',
      color: (resumen?.resultado_neto ?? 0) >= 0 ? 'text-teal-700' : 'text-red-600',
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-3">
      {metricas.map((m) => (
        <div
          key={m.label}
          className="bg-gray-100 rounded-lg px-4 py-3"
        >
          <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">
            {m.label}
          </div>
          {loading ? (
            <div className="h-7 w-24 bg-gray-200 rounded animate-pulse" />
          ) : (
            <div className={`text-xl font-medium ${m.color}`}>
              {formatMonto(m.valor)}
            </div>
          )}
          <div className="text-[11px] text-gray-400 mt-1">{m.sub}</div>
        </div>
      ))}
    </div>
  )
}
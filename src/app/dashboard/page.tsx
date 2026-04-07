'use client'

import Link from 'next/link'
import { useDashboard } from '@/hooks/use-dashboard'
import { MetricasDashboard } from '@/components/dashboard/metricas'
import {
  VentasRecientes,
  TopProductos,
  AlertasStock,
  FabricacionPendiente,
} from '@/components/dashboard/tablas'

export default function DashboardPage() {
  const {
    resumen,
    ventasRecientes,
    topProductos,
    alertasStock,
    fabricacionPendiente,
    loading,
    error,
  } = useDashboard()

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      </div>
    )
  }

  const fecha = new Date().toLocaleDateString('es-AR', {
    month: 'long', year: 'numeric'
  })

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Dashboard</p>
          <h1 className="text-base font-medium text-gray-900 capitalize">{fecha}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/ventas/presupuestos/nuevo"
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50"
          >
            + Presupuesto
          </Link>
          <Link
            href="/dashboard/ventas/nueva"
            className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            + Nueva venta
          </Link>
        </div>
      </div>

      {/* Métricas */}
      <MetricasDashboard resumen={resumen} loading={loading} />

      {/* Fila principal: ventas + top productos */}
      <div className="grid grid-cols-2 gap-4">
        <VentasRecientes ventas={ventasRecientes} loading={loading} />
        <TopProductos productos={topProductos} loading={loading} />
      </div>

      {/* Fila inferior: alertas stock + fabricación */}
      <div className="grid grid-cols-2 gap-4">
        <AlertasStock alertas={alertasStock} loading={loading} />
        <FabricacionPendiente items={fabricacionPendiente} loading={loading} />
      </div>
    </div>
  )
}
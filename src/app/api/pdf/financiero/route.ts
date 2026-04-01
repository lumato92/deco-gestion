// src/app/api/pdf/financiero/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { BRAND, COLORS, baseStyles } from '@/lib/pdf/base'
import { formatMonto } from '@/lib/utils'
import React from 'react'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const s = StyleSheet.create({
  kpisRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  kpi: { flex: 1, borderWidth: 0.5, borderColor: COLORS.border, borderStyle: 'solid', borderRadius: 3, padding: 14 },
  kpiLabel: { fontSize: 8, color: COLORS.ultraLight, letterSpacing: 1, marginBottom: 5 },
  kpiValue: { fontSize: 18, color: COLORS.black, marginBottom: 3 },
  kpiSub: { fontSize: 9, color: COLORS.lightGray },
  resultadoBlock: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.bg, borderRadius: 3, padding: 16, marginBottom: 24,
  },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel: { fontSize: 9, color: COLORS.gray, width: 70, textAlign: 'right' },
  barTrack: { flex: 1, height: 4, backgroundColor: '#f0f0f0', borderRadius: 2 },
  barFill: { height: 4, backgroundColor: COLORS.black, borderRadius: 2 },
  barValue: { fontSize: 9, color: COLORS.gray, width: 65, textAlign: 'right' },
  tableHeader: {
    flexDirection: 'row', borderBottomWidth: 1.5,
    borderBottomColor: COLORS.black, borderBottomStyle: 'solid', paddingBottom: 7,
  },
  tableRow: {
    flexDirection: 'row', borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border, borderBottomStyle: 'solid', paddingVertical: 8,
  },
  thText: { fontSize: 8, color: COLORS.lightGray, letterSpacing: 1 },
  tdText: { fontSize: 10, color: COLORS.gray },
  tdBold: { fontSize: 10, color: COLORS.black, fontFamily: 'Helvetica-Bold' },
})

export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || (sesion.rol !== 'root' && sesion.rol !== 'admin')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes') ?? new Date().getMonth() + 1)
  const anio = Number(searchParams.get('anio') ?? new Date().getFullYear())

  const supabase = await createClient()

  const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`
  const fin = new Date(anio, mes, 0).toISOString().split('T')[0]

  const [ventasRes, gastosRes, topItemsRes] = await Promise.all([
    supabase.from('pedidos_con_total').select('*')
      .gte('fecha_confirmacion', inicio)
      .lte('fecha_confirmacion', fin + 'T23:59:59')
      .not('estado', 'in', '("presupuesto","cancelado")'),
    supabase.from('gastos').select('monto, categoria')
      .gte('fecha', inicio).lte('fecha', fin),
    supabase.from('items_pedido')
      .select('nombre_producto, cantidad, precio_unitario, pedido_id'),
  ])

  const ventasData = ventasRes.data ?? []
  const gastosData = gastosRes.data ?? []

  const totalIngresos = ventasData.reduce((s: number, v: any) => s + (v.total_cobrado ?? 0), 0)
  const totalGastos = gastosData.reduce((s: number, g: any) => s + (g.monto ?? 0), 0)
  const resultado = totalIngresos - totalGastos
  const margen = totalIngresos > 0 ? Math.round(resultado / totalIngresos * 100) : 0
  const cantidadVentas = ventasData.length
  const ticketPromedio = cantidadVentas > 0 ? Math.round(totalIngresos / cantidadVentas) : 0

  // Canales
  const canalesMap: Record<string, number> = {}
  ventasData.forEach((v: any) => {
    const c = v.canal_venta ?? 'directo'
    canalesMap[c] = (canalesMap[c] ?? 0) + (v.total_cobrado ?? 0)
  })
  const canales = Object.entries(canalesMap)
    .map(([canal, monto]) => ({ canal: canal.charAt(0).toUpperCase() + canal.slice(1), monto }))
    .sort((a, b) => b.monto - a.monto)
  const maxCanal = Math.max(...canales.map(c => c.monto), 1)

  // Gastos por categoría
  const catMap: Record<string, number> = {}
  gastosData.forEach((g: any) => {
    const c = g.categoria ?? 'Otros'
    catMap[c] = (catMap[c] ?? 0) + (g.monto ?? 0)
  })
  const gastosCat = Object.entries(catMap)
    .map(([cat, monto]) => ({ cat, monto, pct: totalGastos > 0 ? (monto / totalGastos * 100).toFixed(1) : '0' }))
    .sort((a, b) => b.monto - a.monto)

  // Top productos — filtrar por pedidos del mes
  const pedidoIds = new Set(ventasData.map((v: any) => v.id))
  const topData = (topItemsRes.data ?? []).filter((i: any) => pedidoIds.has(i.pedido_id))
  const prodMap: Record<string, { unidades: number; ingresos: number }> = {}
  topData.forEach((i: any) => {
    if (!prodMap[i.nombre_producto]) prodMap[i.nombre_producto] = { unidades: 0, ingresos: 0 }
    prodMap[i.nombre_producto].unidades += i.cantidad
    prodMap[i.nombre_producto].ingresos += i.cantidad * i.precio_unitario
  })
  const topProductos = Object.entries(prodMap)
    .map(([nombre, d]) => ({ nombre, ...d }))
    .sort((a, b) => b.ingresos - a.ingresos)
    .slice(0, 8)

  const fechaGeneracion = new Date().toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Construir el Document directamente — sin componente wrapper
  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: baseStyles.page },

      // Header
      React.createElement(View, { style: baseStyles.header },
        React.createElement(View, { style: baseStyles.logoArea },
          React.createElement(Image, { src: '/logo.png', style: baseStyles.logo }),
          React.createElement(Text, { style: baseStyles.brandName }, BRAND.nombre),
          React.createElement(Text, { style: baseStyles.brandSub }, BRAND.sub),
        ),
        React.createElement(View, { style: { alignItems: 'flex-end' } },
          React.createElement(Text, { style: { fontSize: 18, color: COLORS.black, marginBottom: 4 } }, 'Resumen financiero'),
          React.createElement(Text, { style: { fontSize: 12, color: COLORS.gray } }, `${MESES[mes - 1]} ${anio}`),
          React.createElement(Text, { style: { fontSize: 9, color: COLORS.ultraLight, marginTop: 3 } }, `Generado el ${fechaGeneracion} · Confidencial`),
        ),
      ),

      // Body
      React.createElement(View, { style: baseStyles.body },

        // KPIs
        React.createElement(View, { style: s.kpisRow },
          React.createElement(View, { style: s.kpi },
            React.createElement(Text, { style: s.kpiLabel }, 'INGRESOS'),
            React.createElement(Text, { style: s.kpiValue }, formatMonto(totalIngresos)),
          ),
          React.createElement(View, { style: s.kpi },
            React.createElement(Text, { style: s.kpiLabel }, 'GASTOS'),
            React.createElement(Text, { style: s.kpiValue }, formatMonto(totalGastos)),
          ),
          React.createElement(View, { style: s.kpi },
            React.createElement(Text, { style: s.kpiLabel }, 'RESULTADO NETO'),
            React.createElement(Text, { style: [s.kpiValue, { color: resultado >= 0 ? COLORS.green : COLORS.red }] }, formatMonto(resultado)),
            React.createElement(Text, { style: s.kpiSub }, `Margen ${margen}%`),
          ),
        ),

        // Resultado destacado
        React.createElement(View, { style: s.resultadoBlock },
          React.createElement(View, null,
            React.createElement(Text, { style: { fontSize: 8, color: COLORS.ultraLight, letterSpacing: 1, marginBottom: 5 } }, 'GANANCIA DEL MES'),
            React.createElement(Text, { style: { fontSize: 24, color: COLORS.green } }, formatMonto(resultado)),
            React.createElement(Text, { style: { fontSize: 9, color: COLORS.lightGray, marginTop: 3 } }, `${margen}% de margen neto`),
          ),
          React.createElement(View, { style: { alignItems: 'flex-end' } },
            React.createElement(Text, { style: { fontSize: 8, color: COLORS.ultraLight, letterSpacing: 1, marginBottom: 4 } }, 'VENTAS'),
            React.createElement(Text, { style: { fontSize: 20, color: COLORS.black, marginBottom: 8 } }, String(cantidadVentas)),
            React.createElement(Text, { style: { fontSize: 8, color: COLORS.ultraLight, letterSpacing: 1, marginBottom: 4 } }, 'TICKET PROM.'),
            React.createElement(Text, { style: { fontSize: 14, color: COLORS.black } }, formatMonto(ticketPromedio)),
          ),
        ),

        // Canales
        React.createElement(Text, { style: baseStyles.sectionTitle }, 'Ingresos por canal'),
        ...canales.map(c =>
          React.createElement(View, { key: c.canal, style: s.barRow },
            React.createElement(Text, { style: s.barLabel }, c.canal),
            React.createElement(View, { style: s.barTrack },
              React.createElement(View, { style: [s.barFill, { width: `${Math.round(c.monto / maxCanal * 100)}%` }] }),
            ),
            React.createElement(Text, { style: s.barValue }, formatMonto(c.monto)),
          )
        ),

        React.createElement(View, { style: baseStyles.divider }),

        // Gastos
        React.createElement(Text, { style: baseStyles.sectionTitle }, 'Egresos por categoría'),
        React.createElement(View, { style: s.tableHeader },
          React.createElement(Text, { style: [s.thText, { flex: 3 }] }, 'CATEGORÍA'),
          React.createElement(Text, { style: [s.thText, { width: 80, textAlign: 'right' }] }, 'MONTO'),
          React.createElement(Text, { style: [s.thText, { width: 60, textAlign: 'right' }] }, '% TOTAL'),
        ),
        ...gastosCat.map(g =>
          React.createElement(View, { key: g.cat, style: s.tableRow },
            React.createElement(Text, { style: [s.tdText, { flex: 3 }] }, g.cat),
            React.createElement(Text, { style: [s.tdText, { width: 80, textAlign: 'right' }] }, formatMonto(g.monto)),
            React.createElement(Text, { style: [s.tdText, { width: 60, textAlign: 'right' }] }, `${g.pct}%`),
          )
        ),
        React.createElement(View, { style: [s.tableRow, { borderTopWidth: 1.5, borderTopColor: COLORS.black, borderTopStyle: 'solid', borderBottomWidth: 0 }] },
          React.createElement(Text, { style: [s.tdBold, { flex: 3 }] }, 'Total'),
          React.createElement(Text, { style: [s.tdBold, { width: 80, textAlign: 'right' }] }, formatMonto(totalGastos)),
          React.createElement(Text, { style: [s.tdBold, { width: 60, textAlign: 'right' }] }, '100%'),
        ),

        React.createElement(View, { style: baseStyles.divider }),

        // Top productos
        React.createElement(Text, { style: baseStyles.sectionTitle }, 'Top productos del mes'),
        React.createElement(View, { style: s.tableHeader },
          React.createElement(Text, { style: [s.thText, { flex: 3 }] }, 'PRODUCTO'),
          React.createElement(Text, { style: [s.thText, { width: 60, textAlign: 'right' }] }, 'UNIDADES'),
          React.createElement(Text, { style: [s.thText, { width: 80, textAlign: 'right' }] }, 'INGRESOS'),
        ),
        ...topProductos.map(p =>
          React.createElement(View, { key: p.nombre, style: s.tableRow },
            React.createElement(Text, { style: [s.tdText, { flex: 3 }] }, p.nombre),
            React.createElement(Text, { style: [s.tdText, { width: 60, textAlign: 'right' }] }, String(p.unidades)),
            React.createElement(Text, { style: [s.tdText, { width: 80, textAlign: 'right' }] }, formatMonto(p.ingresos)),
          )
        ),
      ),

      // Footer
      React.createElement(View, { style: baseStyles.footer },
        React.createElement(Text, { style: baseStyles.footerText }, BRAND.direccion),
        React.createElement(Text, { style: [baseStyles.footerText, { textAlign: 'center' }] }, BRAND.horario),
        React.createElement(Text, { style: [baseStyles.footerText, { textAlign: 'right' }] }, `WA ${BRAND.whatsapp}\n${BRAND.instagram}`),
      ),
    )
  )

  const buffer = await renderToBuffer(doc)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="financiero-${MESES[mes - 1].toLowerCase()}-${anio}.pdf"`,
    },
  })
}
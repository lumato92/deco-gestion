// src/lib/pdf/financiero.tsx

import React from 'react'
import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import { BRAND, COLORS, baseStyles } from './base'
import { formatMonto } from '@/lib/utils'

interface GastoCategoria {
  categoria: string
  monto: number
  porcentaje: number
}

interface TopProducto {
  nombre: string
  unidades: number
  ingresos: number
}

interface CanalVenta {
  canal: string
  monto: number
  porcentaje: number
}

interface FinancieroPDFProps {
  mes: string          // "Marzo 2025"
  fechaGeneracion: string
  ingresos: number
  gastos: number
  cantidadVentas: number
  ticketPromedio: number
  ingresosVsMesAnterior?: number  // porcentaje, positivo o negativo
  gastosVsMesAnterior?: number
  canales: CanalVenta[]
  gastosPorCategoria: GastoCategoria[]
  topProductos: TopProducto[]
}

const s = StyleSheet.create({
  docTitle: { fontSize: 18, color: COLORS.black, marginBottom: 4 },
  docPeriod: { fontSize: 12, color: COLORS.gray },
  docSub: { fontSize: 9, color: COLORS.ultraLight, marginTop: 3 },
  kpisRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  kpi: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderStyle: 'solid',
    borderRadius: 3,
    padding: 14,
  },
  kpiLabel: { fontSize: 8, color: COLORS.ultraLight, letterSpacing: 1, marginBottom: 5 },
  kpiValue: { fontSize: 18, color: COLORS.black, marginBottom: 3 },
  kpiSub: { fontSize: 9, color: COLORS.lightGray },
  resultadoBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 3,
    padding: 16,
    marginBottom: 24,
  },
  resLabel: { fontSize: 8, color: COLORS.ultraLight, letterSpacing: 1, marginBottom: 5 },
  resValue: { fontSize: 24, color: COLORS.green },
  resPct: { fontSize: 9, color: COLORS.lightGray, marginTop: 3 },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  barLabel: { fontSize: 9, color: COLORS.gray, width: 70, textAlign: 'right' },
  barTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
  },
  barFill: {
    height: 4,
    backgroundColor: COLORS.black,
    borderRadius: 2,
  },
  barValue: { fontSize: 9, color: COLORS.gray, width: 65, textAlign: 'right' },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.black,
    borderBottomStyle: 'solid',
    paddingBottom: 7,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    borderBottomStyle: 'solid',
    paddingVertical: 8,
  },
  thText: { fontSize: 8, color: COLORS.lightGray, letterSpacing: 1 },
  tdText: { fontSize: 10, color: COLORS.gray },
  tdBold: { fontSize: 10, color: COLORS.black, fontFamily: 'Helvetica-Bold' },
})

export function FinancieroPDF({
  mes, fechaGeneracion, ingresos, gastos,
  cantidadVentas, ticketPromedio,
  ingresosVsMesAnterior, gastosVsMesAnterior,
  canales, gastosPorCategoria, topProductos,
}: FinancieroPDFProps) {
  const resultado = ingresos - gastos
  const margen = ingresos > 0 ? Math.round(resultado / ingresos * 100) : 0
  const maxCanal = Math.max(...canales.map(c => c.monto), 1)

  return (
    <Document>
      <Page size="A4" style={baseStyles.page}>

        {/* Header */}
        <View style={baseStyles.header}>
          <View style={baseStyles.logoArea}>
            <Image src="/logo.png" style={baseStyles.logo} />
            <Text style={baseStyles.brandName}>{BRAND.nombre}</Text>
            <Text style={baseStyles.brandSub}>{BRAND.sub}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.docTitle}>Resumen financiero</Text>
            <Text style={s.docPeriod}>{mes}</Text>
            <Text style={s.docSub}>Generado el {fechaGeneracion} · Confidencial</Text>
          </View>
        </View>

        {/* Body */}
        <View style={baseStyles.body}>

          {/* KPIs */}
          <View style={s.kpisRow}>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>INGRESOS</Text>
              <Text style={s.kpiValue}>{formatMonto(ingresos)}</Text>
              {ingresosVsMesAnterior !== undefined && (
                <Text style={[s.kpiSub, { color: ingresosVsMesAnterior >= 0 ? COLORS.green : COLORS.red }]}>
                  {ingresosVsMesAnterior >= 0 ? '↑' : '↓'} {Math.abs(ingresosVsMesAnterior)}% vs mes ant.
                </Text>
              )}
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>GASTOS</Text>
              <Text style={s.kpiValue}>{formatMonto(gastos)}</Text>
              {gastosVsMesAnterior !== undefined && (
                <Text style={[s.kpiSub, { color: gastosVsMesAnterior <= 0 ? COLORS.green : COLORS.red }]}>
                  {gastosVsMesAnterior >= 0 ? '↑' : '↓'} {Math.abs(gastosVsMesAnterior)}% vs mes ant.
                </Text>
              )}
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>RESULTADO NETO</Text>
              <Text style={[s.kpiValue, { color: resultado >= 0 ? COLORS.green : COLORS.red }]}>
                {formatMonto(resultado)}
              </Text>
              <Text style={s.kpiSub}>Margen {margen}%</Text>
            </View>
          </View>

          {/* Resultado destacado */}
          <View style={s.resultadoBlock}>
            <View>
              <Text style={s.resLabel}>GANANCIA DEL MES</Text>
              <Text style={s.resValue}>{formatMonto(resultado)}</Text>
              <Text style={s.resPct}>{margen}% de margen neto sobre ingresos</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.resLabel, { marginBottom: 4 }]}>VENTAS</Text>
              <Text style={{ fontSize: 20, color: COLORS.black, marginBottom: 8 }}>{cantidadVentas}</Text>
              <Text style={[s.resLabel, { marginBottom: 4 }]}>TICKET PROM.</Text>
              <Text style={{ fontSize: 14, color: COLORS.black }}>{formatMonto(ticketPromedio)}</Text>
            </View>
          </View>

          {/* Ingresos por canal */}
          <Text style={baseStyles.sectionTitle}>Ingresos por canal de venta</Text>
          {canales.map((c, idx) => (
            <View key={idx} style={s.barRow}>
              <Text style={s.barLabel}>{c.canal}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${(c.monto / maxCanal) * 100}%` }]} />
              </View>
              <Text style={s.barValue}>{formatMonto(c.monto)}</Text>
            </View>
          ))}

          <View style={baseStyles.divider} />

          {/* Gastos por categoría */}
          <Text style={baseStyles.sectionTitle}>Egresos por categoría</Text>
          <View style={s.tableHeader}>
            <Text style={[s.thText, { flex: 3 }]}>CATEGORÍA</Text>
            <Text style={[s.thText, { width: 80, textAlign: 'right' }]}>MONTO</Text>
            <Text style={[s.thText, { width: 60, textAlign: 'right' }]}>% TOTAL</Text>
          </View>
          {gastosPorCategoria.map((g, idx) => (
            <View key={idx} style={s.tableRow}>
              <Text style={[s.tdText, { flex: 3 }]}>{g.categoria}</Text>
              <Text style={[s.tdText, { width: 80, textAlign: 'right' }]}>{formatMonto(g.monto)}</Text>
              <Text style={[s.tdText, { width: 60, textAlign: 'right' }]}>{g.porcentaje.toFixed(1)}%</Text>
            </View>
          ))}
          <View style={[s.tableRow, { borderTopWidth: 1.5, borderTopColor: COLORS.black, borderTopStyle: 'solid', borderBottomWidth: 0 }]}>
            <Text style={[s.tdBold, { flex: 3 }]}>Total</Text>
            <Text style={[s.tdBold, { width: 80, textAlign: 'right' }]}>{formatMonto(gastos)}</Text>
            <Text style={[s.tdBold, { width: 60, textAlign: 'right' }]}>100%</Text>
          </View>

          <View style={baseStyles.divider} />

          {/* Top productos */}
          <Text style={baseStyles.sectionTitle}>Top productos del mes</Text>
          <View style={s.tableHeader}>
            <Text style={[s.thText, { flex: 3 }]}>PRODUCTO</Text>
            <Text style={[s.thText, { width: 60, textAlign: 'right' }]}>UNIDADES</Text>
            <Text style={[s.thText, { width: 80, textAlign: 'right' }]}>INGRESOS</Text>
          </View>
          {topProductos.map((p, idx) => (
            <View key={idx} style={s.tableRow}>
              <Text style={[s.tdText, { flex: 3 }]}>{p.nombre}</Text>
              <Text style={[s.tdText, { width: 60, textAlign: 'right' }]}>{p.unidades}</Text>
              <Text style={[s.tdText, { width: 80, textAlign: 'right' }]}>{formatMonto(p.ingresos)}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={baseStyles.footer}>
          <Text style={baseStyles.footerText}>{BRAND.direccion}</Text>
          <Text style={[baseStyles.footerText, { textAlign: 'center' }]}>{BRAND.horario}</Text>
          <Text style={[baseStyles.footerText, { textAlign: 'right' }]}>
            WA {BRAND.whatsapp}{'\n'}{BRAND.instagram}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
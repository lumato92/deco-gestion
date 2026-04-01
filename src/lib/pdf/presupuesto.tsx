// src/lib/pdf/presupuesto.tsx

import React from 'react'
import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import { BRAND, COLORS, baseStyles } from './base'
import { formatMonto } from '@/lib/utils'

interface ItemPresupuesto {
  nombre_producto: string
  descripcion?: string
  cantidad: number
  precio_unitario: number
}

interface PresupuestoPDFProps {
  numero: number
  fecha: string
  validoHasta: string
  cliente: {
    nombre: string
    telefono?: string
    email?: string
    canal?: string
  }
  items: ItemPresupuesto[]
  descuento_pct?: number
  notas?: string
  fecha_entrega?: string
  tipo_entrega?: 'stock' | 'fabricacion'
  adelanto?: number
}

const s = StyleSheet.create({
  docTitle: { fontSize: 20, color: COLORS.black, marginBottom: 5, letterSpacing: 0.5 },
  docNum: { fontSize: 10, color: COLORS.gray, marginBottom: 2 },
  docDate: { fontSize: 10, color: COLORS.lightGray },
  validity: { fontSize: 9, color: COLORS.ultraLight, marginTop: 4 },
  clientBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    paddingBottom: 24,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    borderBottomStyle: 'solid',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.black,
    borderBottomStyle: 'solid',
    paddingBottom: 8,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    borderBottomStyle: 'solid',
    paddingVertical: 10,
  },
  colDesc: { flex: 3, paddingRight: 8 },
  colCant: { width: 40, textAlign: 'center' },
  colPrecio: { width: 70, textAlign: 'right' },
  colTotal: { width: 70, textAlign: 'right' },
  thText: { fontSize: 8, color: COLORS.lightGray, letterSpacing: 1 },
  tdText: { fontSize: 10, color: COLORS.black },
  tdSubText: { fontSize: 9, color: COLORS.ultraLight, marginTop: 2 },
  tdMuted: { fontSize: 10, color: COLORS.gray },
  totalsBlock: {
    alignSelf: 'flex-end',
    width: 180,
    marginTop: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    borderBottomStyle: 'solid',
  },
  totalFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.black,
    borderTopStyle: 'solid',
  },
  tag: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  notesBlock: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    borderTopStyle: 'solid',
  },
  adelantoBox: {
    backgroundColor: COLORS.bg,
    padding: 10,
    borderRadius: 3,
    marginTop: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderStyle: 'solid',
  },
})

export function PresupuestoPDF({
  numero, fecha, validoHasta, cliente, items,
  descuento_pct = 0, notas, fecha_entrega, tipo_entrega, adelanto,
}: PresupuestoPDFProps) {
  const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
  const descuentoMonto = subtotal * descuento_pct / 100
  const total = subtotal - descuentoMonto

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
            <Text style={s.docTitle}>Presupuesto</Text>
            <Text style={s.docNum}>N° {String(numero).padStart(4, '0')}</Text>
            <Text style={s.docDate}>{fecha}</Text>
            <Text style={s.validity}>Válido hasta: {validoHasta}</Text>
          </View>
        </View>

        {/* Body */}
        <View style={baseStyles.body}>

          {/* Cliente */}
          <View style={s.clientBlock}>
            <View>
              <Text style={baseStyles.sectionTitle}>Cliente</Text>
              <Text style={[s.tdText, { fontSize: 13, marginBottom: 3 }]}>{cliente.nombre}</Text>
              {cliente.telefono && <Text style={s.tdMuted}>{cliente.telefono}</Text>}
              {cliente.email && <Text style={s.tdMuted}>{cliente.email}</Text>}
              {cliente.canal && (
                <View style={s.tag}>
                  <Text style={{ fontSize: 8, color: COLORS.gray }}>{cliente.canal}</Text>
                </View>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {fecha_entrega && (
                <View style={{ marginBottom: 12, alignItems: 'flex-end' }}>
                  <Text style={baseStyles.fieldLabel}>Entrega estimada</Text>
                  <Text style={baseStyles.fieldValueSm}>{fecha_entrega}</Text>
                </View>
              )}
              {tipo_entrega && (
                <View style={{ marginBottom: 12, alignItems: 'flex-end' }}>
                  <Text style={baseStyles.fieldLabel}>Tipo de entrega</Text>
                  <Text style={baseStyles.fieldValueSm}>
                    {tipo_entrega === 'fabricacion' ? 'Fabricación externa' : 'Stock disponible'}
                  </Text>
                </View>
              )}
              {adelanto && adelanto > 0 && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={baseStyles.fieldLabel}>Adelanto requerido (50%)</Text>
                  <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: COLORS.black }}>
                    {formatMonto(adelanto)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Tabla de productos */}
          <Text style={baseStyles.sectionTitle}>Productos</Text>
          <View style={s.tableHeader}>
            <Text style={[s.thText, s.colDesc]}>Descripción</Text>
            <Text style={[s.thText, s.colCant, { textAlign: 'center' }]}>Cant.</Text>
            <Text style={[s.thText, s.colPrecio, { textAlign: 'right' }]}>Precio unit.</Text>
            <Text style={[s.thText, s.colTotal, { textAlign: 'right' }]}>Total</Text>
          </View>
          {items.map((item, idx) => (
            <View key={idx} style={s.tableRow}>
              <View style={s.colDesc}>
                <Text style={s.tdText}>{item.nombre_producto}</Text>
                {item.descripcion && <Text style={s.tdSubText}>{item.descripcion}</Text>}
              </View>
              <Text style={[s.colCant, s.tdMuted, { textAlign: 'center' }]}>{item.cantidad}</Text>
              <Text style={[s.colPrecio, s.tdMuted, { textAlign: 'right' }]}>{formatMonto(item.precio_unitario)}</Text>
              <Text style={[s.colTotal, { textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 10 }]}>
                {formatMonto(item.cantidad * item.precio_unitario)}
              </Text>
            </View>
          ))}

          {/* Totales */}
          <View style={s.totalsBlock}>
            <View style={s.totalRow}>
              <Text style={{ fontSize: 10, color: COLORS.gray }}>Subtotal</Text>
              <Text style={{ fontSize: 10, color: COLORS.gray }}>{formatMonto(subtotal)}</Text>
            </View>
            {descuento_pct > 0 && (
              <View style={s.totalRow}>
                <Text style={{ fontSize: 10, color: COLORS.gray }}>Descuento ({descuento_pct}%)</Text>
                <Text style={{ fontSize: 10, color: COLORS.gray }}>— {formatMonto(descuentoMonto)}</Text>
              </View>
            )}
            <View style={s.totalFinal}>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold' }}>Total</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold' }}>{formatMonto(total)}</Text>
            </View>
          </View>

          {/* Notas */}
          {notas && (
            <View style={s.notesBlock}>
              <Text style={baseStyles.sectionTitle}>Notas</Text>
              <Text style={{ fontSize: 10, color: COLORS.gray, lineHeight: 1.6, fontStyle: 'italic' }}>
                {notas}
              </Text>
            </View>
          )}
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
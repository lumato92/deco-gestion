// src/lib/pdf/remito.tsx

import React from 'react'
import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import { BRAND, COLORS, baseStyles } from './base'

interface ItemRemito {
  nombre_producto: string
  descripcion?: string
  cantidad: number
  estado?: string
}

interface RemitoPDFProps {
  numero: number
  fecha: string
  pedido_id: number
  cliente: {
    nombre: string
    direccion?: string
    telefono?: string
  }
  items: ItemRemito[]
  modalidad_entrega?: string
  estado_pago?: string
}

const s = StyleSheet.create({
  docTitle: { fontSize: 18, color: COLORS.black, marginBottom: 4, letterSpacing: 0.5 },
  docNum: { fontSize: 10, color: COLORS.gray, marginBottom: 2 },
  docDate: { fontSize: 9, color: COLORS.lightGray },
  twoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 20,
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
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    borderBottomStyle: 'solid',
    paddingVertical: 11,
    alignItems: 'center',
  },
  colDesc: { flex: 3, paddingRight: 8 },
  colCant: { width: 50, textAlign: 'center' },
  colEstado: { width: 70, textAlign: 'center' },
  colCheck: { width: 60, textAlign: 'center' },
  thText: { fontSize: 8, color: COLORS.lightGray, letterSpacing: 1 },
  tdText: { fontSize: 10, color: COLORS.black },
  tdSub: { fontSize: 9, color: COLORS.ultraLight, marginTop: 2 },
  tdCenter: { fontSize: 10, color: COLORS.gray, textAlign: 'center' },
  checkbox: {
    width: 12,
    height: 12,
    borderWidth: 0.5,
    borderColor: COLORS.lightGray,
    borderStyle: 'solid',
    alignSelf: 'center',
  },
  firmaSection: {
    flexDirection: 'row',
    gap: 40,
    marginTop: 28,
  },
  firmaBox: {
    flex: 1,
    gap: 8,
  },
  firmaLine: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.black,
    borderBottomStyle: 'solid',
    height: 44,
  },
  firmaLabel: {
    fontSize: 8,
    color: COLORS.ultraLight,
    letterSpacing: 1,
    fontFamily: 'Helvetica-Bold',
  },
  firmaSub: {
    fontSize: 9,
    color: '#cccccc',
    marginTop: 2,
  },
  badge: {
    borderWidth: 0.5,
    borderColor: COLORS.lightGray,
    borderStyle: 'solid',
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    borderRadius: 2,
  },
})

export function RemitoPDF({
  numero, fecha, pedido_id, cliente, items, modalidad_entrega, estado_pago,
}: RemitoPDFProps) {
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
            <Text style={s.docTitle}>Remito de entrega</Text>
            <Text style={s.docNum}>N° R-{String(numero).padStart(4, '0')}</Text>
            <Text style={s.docDate}>Buenos Aires, {fecha}</Text>
          </View>
        </View>

        {/* Body */}
        <View style={baseStyles.body}>

          {/* Datos */}
          <View style={s.twoCol}>
            <View>
              <Text style={baseStyles.fieldLabel}>Entregar a</Text>
              <Text style={[baseStyles.fieldValue, { marginBottom: 2 }]}>{cliente.nombre}</Text>
              {cliente.direccion && (
                <Text style={baseStyles.fieldValueSm}>{cliente.direccion}</Text>
              )}
              {cliente.telefono && (
                <View style={{ marginTop: 10 }}>
                  <Text style={baseStyles.fieldLabel}>Teléfono</Text>
                  <Text style={baseStyles.fieldValueSm}>{cliente.telefono}</Text>
                </View>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ marginBottom: 12, alignItems: 'flex-end' }}>
                <Text style={baseStyles.fieldLabel}>Pedido</Text>
                <Text style={baseStyles.fieldValueSm}>#{String(pedido_id).padStart(4, '0')}</Text>
              </View>
              {modalidad_entrega && (
                <View style={{ marginBottom: 12, alignItems: 'flex-end' }}>
                  <Text style={baseStyles.fieldLabel}>Modalidad</Text>
                  <Text style={baseStyles.fieldValueSm}>{modalidad_entrega}</Text>
                </View>
              )}
              {estado_pago && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={baseStyles.fieldLabel}>Estado del pago</Text>
                  <View style={s.badge}>
                    <Text style={{ fontSize: 9, color: COLORS.gray }}>{estado_pago}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Tabla */}
          <Text style={baseStyles.sectionTitle}>Productos entregados</Text>
          <View style={s.tableHeader}>
            <Text style={[s.thText, s.colDesc]}>Producto</Text>
            <Text style={[s.thText, s.colCant, { textAlign: 'center' }]}>Cant.</Text>
            <Text style={[s.thText, s.colEstado, { textAlign: 'center' }]}>Estado</Text>
            <Text style={[s.thText, s.colCheck, { textAlign: 'center' }]}>Recibido</Text>
          </View>
          {items.map((item, idx) => (
            <View key={idx} style={s.tableRow}>
              <View style={s.colDesc}>
                <Text style={s.tdText}>{item.nombre_producto}</Text>
                {item.descripcion && <Text style={s.tdSub}>{item.descripcion}</Text>}
              </View>
              <Text style={[s.tdCenter, s.colCant]}>{item.cantidad}</Text>
              <Text style={[s.tdCenter, s.colEstado, { fontSize: 9 }]}>
                {item.estado ?? 'Completo'}
              </Text>
              <View style={[s.colCheck, { alignItems: 'center' }]}>
                <View style={s.checkbox} />
              </View>
            </View>
          ))}

          {/* Firmas */}
          <View style={s.firmaSection}>
            <View style={s.firmaBox}>
              <View style={s.firmaLine} />
              <Text style={s.firmaLabel}>Firma del receptor</Text>
              <Text style={s.firmaSub}>Aclaración: _____________________</Text>
              <Text style={s.firmaSub}>Fecha: ___/___/______</Text>
            </View>
            <View style={s.firmaBox}>
              <View style={s.firmaLine} />
              <Text style={s.firmaLabel}>Entregado por SU Home</Text>
              <Text style={s.firmaSub}>Nombre: _____________________</Text>
              <Text style={s.firmaSub}>DNI: _________________________</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={[baseStyles.footer, { marginTop: 'auto' }]}>
          <Text style={baseStyles.footerText}>Original · Cliente</Text>
          <Text style={[baseStyles.footerText, { textAlign: 'center' }]}>
            {BRAND.horario}
          </Text>
          <Text style={[baseStyles.footerText, { textAlign: 'right' }]}>
            WA {BRAND.whatsapp}{'\n'}{BRAND.instagram}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
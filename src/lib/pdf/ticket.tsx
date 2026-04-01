// src/lib/pdf/ticket.tsx

import React from 'react'
import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import { BRAND, COLORS, baseStyles } from './base'

interface ItemTicket {
  nombre_producto: string
  cantidad: number
}

interface TicketPDFProps {
  pedido_id: number
  fecha: string
  cliente_nombre?: string
  items: ItemTicket[]
  mensaje_regalo?: string
  qr_data_url: string  // QR generado como data URL desde el servidor
}

const s = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    color: COLORS.black,
  },
  header: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 24,
    paddingHorizontal: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
    borderBottomStyle: 'dashed',
  },
  logo: {
    width: 44,
    height: 34,
    objectFit: 'contain',
    marginBottom: 10,
  },
  brand: {
    fontSize: 12,
    letterSpacing: 3,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  ticketTitle: {
    fontSize: 9,
    letterSpacing: 2,
    color: COLORS.lightGray,
    marginTop: 6,
  },
  body: {
    paddingHorizontal: 40,
    paddingTop: 28,
    paddingBottom: 20,
  },
  mensajeBlock: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.black,
    borderLeftStyle: 'solid',
    paddingLeft: 14,
    paddingVertical: 10,
    marginBottom: 24,
  },
  mensajeText: {
    fontSize: 11,
    color: COLORS.black,
    fontStyle: 'italic',
    lineHeight: 1.6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f2f2f2',
    borderBottomStyle: 'solid',
  },
  itemName: { fontSize: 11, color: COLORS.black },
  itemQty: { fontSize: 10, color: COLORS.ultraLight },
  qrSection: {
    alignItems: 'center',
    marginTop: 28,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#dddddd',
    borderTopStyle: 'dashed',
    gap: 10,
  },
  qrBox: {
    width: 100,
    height: 100,
    borderWidth: 1.5,
    borderColor: COLORS.black,
    borderStyle: 'solid',
    borderRadius: 3,
    padding: 6,
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  qrCode: {
    fontSize: 8,
    color: COLORS.ultraLight,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  qrInstruction: {
    fontSize: 9,
    color: COLORS.lightGray,
    textAlign: 'center',
    lineHeight: 1.6,
    maxWidth: 240,
    marginTop: 4,
  },
  conditionsBlock: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderTopWidth: 0.5,
    borderTopColor: '#eeeeee',
    borderTopStyle: 'solid',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: '#eeeeee',
    borderTopStyle: 'solid',
  },
})

export function TicketPDF({
  pedido_id, fecha, cliente_nombre, items, mensaje_regalo, qr_data_url,
}: TicketPDFProps) {
  return (
    <Document>
      <Page size={[420, 700]} style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <Image src="/logo.png" style={s.logo} />
          <Text style={s.brand}>{BRAND.nombre}</Text>
          <Text style={s.ticketTitle}>TICKET DE REGALO</Text>
        </View>

        {/* Body */}
        <View style={s.body}>

          {mensaje_regalo && (
            <>
              <Text style={baseStyles.sectionTitle}>Mensaje</Text>
              <View style={s.mensajeBlock}>
                <Text style={s.mensajeText}>"{mensaje_regalo}"</Text>
              </View>
            </>
          )}

          <Text style={baseStyles.sectionTitle}>Productos incluidos</Text>
          {items.map((item, idx) => (
            <View key={idx} style={s.itemRow}>
              <Text style={s.itemName}>{item.nombre_producto}</Text>
              <Text style={s.itemQty}>× {item.cantidad}</Text>
            </View>
          ))}

          {/* QR */}
          <View style={s.qrSection}>
            <View style={s.qrBox}>
              <Image src={qr_data_url} style={s.qrImage} />
            </View>
            <Text style={s.qrCode}>PEDIDO #{String(pedido_id).padStart(4, '0')} · SU HOME</Text>
            <Text style={s.qrInstruction}>
              Presentá este código en la tienda o escribinos al WhatsApp para gestionar tu cambio
            </Text>
          </View>
        </View>

        {/* Condiciones */}
        <View style={s.conditionsBlock}>
          <Text style={[baseStyles.sectionTitle, { marginBottom: 6 }]}>Condiciones de cambio</Text>
          <Text style={{ fontSize: 9, color: '#aaaaaa', lineHeight: 1.65 }}>
            Podés cambiar los productos dentro de los 30 días desde la fecha de compra presentando este ticket.
            Los productos deben estar en su estado original, sin uso. El cambio es por productos de igual o mayor valor.
          </Text>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <View>
            <Text style={{ fontSize: 9, color: COLORS.ultraLight, lineHeight: 1.6 }}>
              {BRAND.direccion}
            </Text>
            <Text style={{ fontSize: 9, color: COLORS.ultraLight }}>
              Sáb 10–14  ·  Lun–Vie 11–19
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: COLORS.ultraLight, lineHeight: 1.6 }}>
              WA {BRAND.whatsapp}
            </Text>
            <Text style={{ fontSize: 9, color: COLORS.ultraLight }}>
              {BRAND.instagram}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
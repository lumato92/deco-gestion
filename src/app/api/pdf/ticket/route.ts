// src/app/api/pdf/ticket/route.ts

import { NextRequest, NextResponse } from 'next/server'
<<<<<<< HEAD
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { TicketPDF } from '@/lib/pdf/ticket'
import React from 'react'

=======
import { renderToBuffer, Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { BRAND, COLORS, baseStyles } from '@/lib/pdf/base'
import React from 'react'

const s = StyleSheet.create({
  header: {
    alignItems: 'center', paddingTop: 36, paddingBottom: 24, paddingHorizontal: 40,
    borderBottomWidth: 1, borderBottomColor: '#dddddd', borderBottomStyle: 'dashed',
  },
  logo: { width: 44, height: 34, objectFit: 'contain', marginBottom: 10 },
  brand: { fontSize: 12, letterSpacing: 3, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  ticketTitle: { fontSize: 9, letterSpacing: 2, color: COLORS.lightGray, marginTop: 6 },
  body: { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 20 },
  mensajeBlock: {
    borderLeftWidth: 2, borderLeftColor: COLORS.black, borderLeftStyle: 'solid',
    paddingLeft: 14, paddingVertical: 10, marginBottom: 24,
  },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 9, borderBottomWidth: 0.5,
    borderBottomColor: '#f2f2f2', borderBottomStyle: 'solid',
  },
  qrSection: {
    alignItems: 'center', marginTop: 28, paddingTop: 24,
    borderTopWidth: 1, borderTopColor: '#dddddd', borderTopStyle: 'dashed', gap: 10,
  },
  qrBox: {
    width: 100, height: 100, borderWidth: 1.5,
    borderColor: COLORS.black, borderStyle: 'solid', borderRadius: 3, padding: 6,
  },
  conditionsBlock: {
    backgroundColor: COLORS.bg, paddingHorizontal: 40, paddingVertical: 18,
    borderTopWidth: 0.5, borderTopColor: '#eeeeee', borderTopStyle: 'solid',
  },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 40, paddingVertical: 14,
    borderTopWidth: 0.5, borderTopColor: '#eeeeee', borderTopStyle: 'solid',
  },
})

>>>>>>> integracion-ml
export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = Number(searchParams.get('id'))
  const mensaje = searchParams.get('mensaje') ?? undefined
<<<<<<< HEAD

=======
>>>>>>> integracion-ml
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const supabase = await createClient()

  const [pedidoRes, itemsRes] = await Promise.all([
<<<<<<< HEAD
    supabase
      .from('pedidos')
      .select('id, fecha_pedido, clientes (nombre)')
      .eq('id', id)
      .single(),
    supabase
      .from('items_pedido')
      .select('nombre_producto, cantidad')
      .eq('pedido_id', id),
  ])

  if (!pedidoRes.data) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  const pedido = pedidoRes.data as any

  // Generar QR — encodea el código del pedido para identificarlo al escanear
  const qrDataUrl = await QRCode.toDataURL(
    `SUHOME-PEDIDO-${id}`,
    {
      width: 200,
      margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    }
  )

  const buffer = await renderToBuffer(
    React.createElement(TicketPDF, {
      pedido_id: id,
      fecha: new Date(pedido.fecha_pedido).toLocaleDateString('es-AR', {
        day: 'numeric', month: 'long', year: 'numeric',
      }),
      cliente_nombre: pedido.clientes?.nombre,
      items: itemsRes.data ?? [],
      mensaje_regalo: mensaje,
      qr_data_url: qrDataUrl,
    })
  )

  return new NextResponse(buffer, {
=======
    supabase.from('pedidos').select('id, fecha_pedido, clientes (nombre)').eq('id', id).single(),
    supabase.from('items_pedido').select('nombre_producto, cantidad').eq('pedido_id', id),
  ])

  if (!pedidoRes.data) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const pedido = pedidoRes.data as any
  const items = (itemsRes.data ?? []) as any[]

  const qrDataUrl = await QRCode.toDataURL(`SUHOME-PEDIDO-${id}`, {
    width: 200, margin: 1,
    color: { dark: '#1a1a1a', light: '#ffffff' },
  })

  const fecha = new Date(pedido.fecha_pedido).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const doc = React.createElement(
    Document, null,
    React.createElement(Page, { size: [420, 700], style: { backgroundColor: '#ffffff', fontFamily: 'Helvetica', color: COLORS.black } },

      // Header
      React.createElement(View, { style: s.header },
        React.createElement(Image, { src: '/logo.png', style: s.logo }),
        React.createElement(Text, { style: s.brand }, BRAND.nombre),
        React.createElement(Text, { style: s.ticketTitle }, 'TICKET DE REGALO'),
      ),

      // Body
      React.createElement(View, { style: s.body },

        // Mensaje regalo (opcional)
        mensaje && React.createElement(View, null,
          React.createElement(Text, { style: baseStyles.sectionTitle }, 'Mensaje'),
          React.createElement(View, { style: s.mensajeBlock },
            React.createElement(Text, { style: { fontSize: 11, color: COLORS.black, fontStyle: 'italic', lineHeight: 1.6 } },
              `"${mensaje}"`
            ),
          ),
        ),

        // Items
        React.createElement(Text, { style: baseStyles.sectionTitle }, 'Productos incluidos'),
        ...items.map((item: any, idx: number) =>
          React.createElement(View, { key: idx, style: s.itemRow },
            React.createElement(Text, { style: { fontSize: 11, color: COLORS.black } }, item.nombre_producto),
            React.createElement(Text, { style: { fontSize: 10, color: COLORS.ultraLight } }, `× ${item.cantidad}`),
          )
        ),

        // QR
        React.createElement(View, { style: s.qrSection },
          React.createElement(View, { style: s.qrBox },
            React.createElement(Image, { src: qrDataUrl, style: { width: '100%', height: '100%' } }),
          ),
          React.createElement(Text, { style: { fontSize: 8, color: COLORS.ultraLight, letterSpacing: 1.5, marginTop: 4 } },
            `PEDIDO #${String(id).padStart(4, '0')} · SU HOME`
          ),
          React.createElement(Text, { style: { fontSize: 9, color: COLORS.lightGray, textAlign: 'center', lineHeight: 1.6, maxWidth: 240, marginTop: 4 } },
            'Presentá este código en la tienda o escribinos al WhatsApp para gestionar tu cambio'
          ),
        ),
      ),

      // Condiciones
      React.createElement(View, { style: s.conditionsBlock },
        React.createElement(Text, { style: [baseStyles.sectionTitle, { marginBottom: 6 }] }, 'Condiciones de cambio'),
        React.createElement(Text, { style: { fontSize: 9, color: '#aaaaaa', lineHeight: 1.65 } },
          'Podés cambiar los productos dentro de los 30 días desde la fecha de compra presentando este ticket. Los productos deben estar en su estado original, sin uso. El cambio es por productos de igual o mayor valor.'
        ),
      ),

      // Footer
      React.createElement(View, { style: s.footer },
        React.createElement(View, null,
          React.createElement(Text, { style: { fontSize: 9, color: COLORS.ultraLight, lineHeight: 1.6 } }, BRAND.direccion),
          React.createElement(Text, { style: { fontSize: 9, color: COLORS.ultraLight } }, 'Sáb 10–14  ·  Lun–Vie 11–19'),
        ),
        React.createElement(View, { style: { alignItems: 'flex-end' } },
          React.createElement(Text, { style: { fontSize: 9, color: COLORS.ultraLight, lineHeight: 1.6 } }, `WA ${BRAND.whatsapp}`),
          React.createElement(Text, { style: { fontSize: 9, color: COLORS.ultraLight } }, BRAND.instagram),
        ),
      ),
    )
  )

  const buffer = await renderToBuffer(doc)

  return new NextResponse(new Uint8Array(buffer), {
>>>>>>> integracion-ml
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ticket-regalo-${id}.pdf"`,
    },
  })
}
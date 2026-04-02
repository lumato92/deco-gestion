// src/app/api/pdf/presupuesto/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { BRAND, COLORS, baseStyles } from '@/lib/pdf/base'
import { formatMonto } from '@/lib/utils'
import React from 'react'

const s = StyleSheet.create({
  clientBlock: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 28, paddingBottom: 24,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border, borderBottomStyle: 'solid',
  },
  tableHeader: {
    flexDirection: 'row', borderBottomWidth: 1.5,
    borderBottomColor: COLORS.black, borderBottomStyle: 'solid', paddingBottom: 8, marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row', borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border, borderBottomStyle: 'solid', paddingVertical: 10,
  },
  thText: { fontSize: 8, color: COLORS.lightGray, letterSpacing: 1 },
  tdText: { fontSize: 10, color: COLORS.black },
  tdSub: { fontSize: 9, color: COLORS.ultraLight, marginTop: 2 },
  tdMuted: { fontSize: 10, color: COLORS.gray },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 4, borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border, borderBottomStyle: 'solid',
  },
  totalFinal: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 10, marginTop: 4,
    borderTopWidth: 1.5, borderTopColor: COLORS.black, borderTopStyle: 'solid',
  },
  tag: {
    backgroundColor: '#f5f5f5', paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 20, marginTop: 4, alignSelf: 'flex-start',
  },
  notesBlock: {
    marginTop: 24, paddingTop: 20,
    borderTopWidth: 0.5, borderTopColor: COLORS.border, borderTopStyle: 'solid',
  },
})

export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = Number(searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const supabase = await createClient()

  const [pedidoRes, itemsRes] = await Promise.all([
    supabase.from('pedidos').select(`
      id, fecha_pedido, notas, descuento_pct, canal_venta,
      fecha_entrega, fecha_compromiso_fabricacion,
      clientes (nombre, telefono, email)
    `).eq('id', id).single(),
    supabase.from('items_pedido')
      .select('nombre_producto, cantidad, precio_unitario')
      .eq('pedido_id', id),
  ])

  if (!pedidoRes.data) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const pedido = pedidoRes.data as any
  const items = (itemsRes.data ?? []) as any[]

  const subtotal = items.reduce((s: number, i: any) => s + i.cantidad * i.precio_unitario, 0)
  const descuento = pedido.descuento_pct ?? 0
  const totalFinal = subtotal * (1 - descuento / 100)
  const adelanto = Math.round(totalFinal / 2)

  const fechaPedido = new Date(pedido.fecha_pedido)
  const validoHasta = new Date(fechaPedido)
  validoHasta.setDate(validoHasta.getDate() + 14)
  const fmt = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

  const doc = React.createElement(
    Document, null,
    React.createElement(Page, { size: 'A4', style: baseStyles.page },

      // Header
      React.createElement(View, { style: baseStyles.header },
        React.createElement(View, { style: baseStyles.logoArea },
          React.createElement(Image, { src: '/logo.png', style: baseStyles.logo }),
          React.createElement(Text, { style: baseStyles.brandName }, BRAND.nombre),
          React.createElement(Text, { style: baseStyles.brandSub }, BRAND.sub),
        ),
        React.createElement(View, { style: { alignItems: 'flex-end' } },
          React.createElement(Text, { style: { fontSize: 20, color: COLORS.black, marginBottom: 5 } }, 'Presupuesto'),
          React.createElement(Text, { style: { fontSize: 10, color: COLORS.gray, marginBottom: 2 } }, `N° ${String(id).padStart(4, '0')}`),
          React.createElement(Text, { style: { fontSize: 10, color: COLORS.lightGray } }, fmt(fechaPedido)),
          React.createElement(Text, { style: { fontSize: 9, color: COLORS.ultraLight, marginTop: 4 } }, `Válido hasta: ${fmt(validoHasta)}`),
        ),
      ),

      // Body
      React.createElement(View, { style: baseStyles.body },

        // Cliente
        React.createElement(View, { style: s.clientBlock },
          React.createElement(View, null,
            React.createElement(Text, { style: baseStyles.sectionTitle }, 'Cliente'),
            React.createElement(Text, { style: { fontSize: 13, color: COLORS.black, marginBottom: 3 } }, pedido.clientes?.nombre ?? 'Sin nombre'),
            pedido.clientes?.telefono && React.createElement(Text, { style: s.tdMuted }, pedido.clientes.telefono),
            pedido.clientes?.email && React.createElement(Text, { style: s.tdMuted }, pedido.clientes.email),
            pedido.canal_venta && React.createElement(View, { style: s.tag },
              React.createElement(Text, { style: { fontSize: 8, color: COLORS.gray } }, pedido.canal_venta),
            ),
          ),
          React.createElement(View, { style: { alignItems: 'flex-end' } },
            pedido.fecha_entrega && React.createElement(View, { style: { marginBottom: 12, alignItems: 'flex-end' } },
              React.createElement(Text, { style: baseStyles.fieldLabel }, 'Entrega estimada'),
              React.createElement(Text, { style: baseStyles.fieldValueSm }, fmt(new Date(pedido.fecha_entrega))),
            ),
            React.createElement(View, { style: { marginBottom: 12, alignItems: 'flex-end' } },
              React.createElement(Text, { style: baseStyles.fieldLabel }, 'Tipo de entrega'),
              React.createElement(Text, { style: baseStyles.fieldValueSm },
                pedido.fecha_compromiso_fabricacion ? 'Fabricación externa' : 'Stock disponible'
              ),
            ),
            pedido.fecha_compromiso_fabricacion && React.createElement(View, { style: { alignItems: 'flex-end' } },
              React.createElement(Text, { style: baseStyles.fieldLabel }, 'Adelanto requerido (50%)'),
              React.createElement(Text, { style: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: COLORS.black } }, formatMonto(adelanto)),
            ),
          ),
        ),

        // Tabla productos
        React.createElement(Text, { style: baseStyles.sectionTitle }, 'Productos'),
        React.createElement(View, { style: s.tableHeader },
          React.createElement(Text, { style: [s.thText, { flex: 3 }] }, 'Descripción'),
          React.createElement(Text, { style: [s.thText, { width: 40, textAlign: 'center' }] }, 'Cant.'),
          React.createElement(Text, { style: [s.thText, { width: 70, textAlign: 'right' }] }, 'Precio unit.'),
          React.createElement(Text, { style: [s.thText, { width: 70, textAlign: 'right' }] }, 'Total'),
        ),
        ...items.map((item: any, idx: number) =>
          React.createElement(View, { key: idx, style: s.tableRow },
            React.createElement(View, { style: { flex: 3 } },
              React.createElement(Text, { style: s.tdText }, item.nombre_producto),
            ),
            React.createElement(Text, { style: [s.tdMuted, { width: 40, textAlign: 'center' }] }, String(item.cantidad)),
            React.createElement(Text, { style: [s.tdMuted, { width: 70, textAlign: 'right' }] }, formatMonto(item.precio_unitario)),
            React.createElement(Text, { style: { width: 70, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 10 } },
              formatMonto(item.cantidad * item.precio_unitario)
            ),
          )
        ),

        // Totales
        React.createElement(View, { style: { alignSelf: 'flex-end', width: 180, marginTop: 8 } },
          React.createElement(View, { style: s.totalRow },
            React.createElement(Text, { style: { fontSize: 10, color: COLORS.gray } }, 'Subtotal'),
            React.createElement(Text, { style: { fontSize: 10, color: COLORS.gray } }, formatMonto(subtotal)),
          ),
          descuento > 0 && React.createElement(View, { style: s.totalRow },
            React.createElement(Text, { style: { fontSize: 10, color: COLORS.gray } }, `Descuento (${descuento}%)`),
            React.createElement(Text, { style: { fontSize: 10, color: COLORS.gray } }, `— ${formatMonto(subtotal * descuento / 100)}`),
          ),
          React.createElement(View, { style: s.totalFinal },
            React.createElement(Text, { style: { fontSize: 14, fontFamily: 'Helvetica-Bold' } }, 'Total'),
            React.createElement(Text, { style: { fontSize: 14, fontFamily: 'Helvetica-Bold' } }, formatMonto(totalFinal)),
          ),
        ),

        // Notas
        pedido.notas && React.createElement(View, { style: s.notesBlock },
          React.createElement(Text, { style: baseStyles.sectionTitle }, 'Notas'),
          React.createElement(Text, { style: { fontSize: 10, color: COLORS.gray, lineHeight: 1.6, fontStyle: 'italic' } }, pedido.notas),
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

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="presupuesto-${id}.pdf"`,
    },
  })
}
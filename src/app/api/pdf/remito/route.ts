// src/app/api/pdf/remito/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { BRAND, COLORS, baseStyles } from '@/lib/pdf/base'
import React from 'react'

const s = StyleSheet.create({
  twoCol: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 24, paddingBottom: 20,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border, borderBottomStyle: 'solid',
  },
  tableHeader: {
    flexDirection: 'row', borderBottomWidth: 1.5,
    borderBottomColor: COLORS.black, borderBottomStyle: 'solid', paddingBottom: 8,
  },
  tableRow: {
    flexDirection: 'row', borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border, borderBottomStyle: 'solid',
    paddingVertical: 11, alignItems: 'center',
  },
  thText: { fontSize: 8, color: COLORS.lightGray, letterSpacing: 1 },
  tdText: { fontSize: 10, color: COLORS.black },
  tdCenter: { fontSize: 10, color: COLORS.gray, textAlign: 'center' },
  checkbox: {
    width: 12, height: 12, borderWidth: 0.5,
    borderColor: COLORS.lightGray, borderStyle: 'solid', alignSelf: 'center',
  },
  firmaSection: { flexDirection: 'row', gap: 40, marginTop: 28 },
  firmaLine: { borderBottomWidth: 1, borderBottomColor: COLORS.black, borderBottomStyle: 'solid', height: 44 },
  firmaLabel: { fontSize: 8, color: COLORS.ultraLight, letterSpacing: 1, fontFamily: 'Helvetica-Bold' },
  firmaSub: { fontSize: 9, color: '#cccccc', marginTop: 2 },
  badge: {
    borderWidth: 0.5, borderColor: COLORS.lightGray, borderStyle: 'solid',
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', borderRadius: 2,
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
      id, fecha_pedido, estado, canal_venta,
      clientes (nombre, telefono)
    `).eq('id', id).single(),
    supabase.from('items_pedido').select('nombre_producto, cantidad').eq('pedido_id', id),
  ])

  if (!pedidoRes.data) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const pedido = pedidoRes.data as any
  const items = (itemsRes.data ?? []) as any[]

  const estadoPago = pedido.estado === 'entregado' ? 'Saldo pagado'
    : pedido.estado === 'confirmado' ? 'Pendiente de cobro'
    : 'Parcialmente pagado'

  const modalidad = pedido.canal_venta === 'tienda' ? 'Retiro en tienda' : 'Envío a domicilio'

  const fecha = new Date(pedido.fecha_pedido).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

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
          React.createElement(Text, { style: { fontSize: 18, color: COLORS.black, marginBottom: 4 } }, 'Remito de entrega'),
          React.createElement(Text, { style: { fontSize: 10, color: COLORS.gray, marginBottom: 2 } }, `N° R-${String(id).padStart(4, '0')}`),
          React.createElement(Text, { style: { fontSize: 9, color: COLORS.lightGray } }, `Buenos Aires, ${fecha}`),
        ),
      ),

      // Body
      React.createElement(View, { style: baseStyles.body },

        // Datos cliente
        React.createElement(View, { style: s.twoCol },
          React.createElement(View, null,
            React.createElement(Text, { style: baseStyles.fieldLabel }, 'Entregar a'),
            React.createElement(Text, { style: [baseStyles.fieldValue, { marginBottom: 2 }] }, pedido.clientes?.nombre ?? 'Sin nombre'),
            pedido.clientes?.telefono && React.createElement(View, { style: { marginTop: 10 } },
              React.createElement(Text, { style: baseStyles.fieldLabel }, 'Teléfono'),
              React.createElement(Text, { style: baseStyles.fieldValueSm }, pedido.clientes.telefono),
            ),
          ),
          React.createElement(View, { style: { alignItems: 'flex-end' } },
            React.createElement(View, { style: { marginBottom: 12, alignItems: 'flex-end' } },
              React.createElement(Text, { style: baseStyles.fieldLabel }, 'Pedido'),
              React.createElement(Text, { style: baseStyles.fieldValueSm }, `#${String(id).padStart(4, '0')}`),
            ),
            React.createElement(View, { style: { marginBottom: 12, alignItems: 'flex-end' } },
              React.createElement(Text, { style: baseStyles.fieldLabel }, 'Modalidad'),
              React.createElement(Text, { style: baseStyles.fieldValueSm }, modalidad),
            ),
            React.createElement(View, { style: { alignItems: 'flex-end' } },
              React.createElement(Text, { style: baseStyles.fieldLabel }, 'Estado del pago'),
              React.createElement(View, { style: s.badge },
                React.createElement(Text, { style: { fontSize: 9, color: COLORS.gray } }, estadoPago),
              ),
            ),
          ),
        ),

        // Tabla items
        React.createElement(Text, { style: baseStyles.sectionTitle }, 'Productos entregados'),
        React.createElement(View, { style: s.tableHeader },
          React.createElement(Text, { style: [s.thText, { flex: 3 }] }, 'Producto'),
          React.createElement(Text, { style: [s.thText, { width: 50, textAlign: 'center' }] }, 'Cant.'),
          React.createElement(Text, { style: [s.thText, { width: 70, textAlign: 'center' }] }, 'Estado'),
          React.createElement(Text, { style: [s.thText, { width: 60, textAlign: 'center' }] }, 'Recibido'),
        ),
        ...items.map((item: any, idx: number) =>
          React.createElement(View, { key: idx, style: s.tableRow },
            React.createElement(Text, { style: [s.tdText, { flex: 3 }] }, item.nombre_producto),
            React.createElement(Text, { style: [s.tdCenter, { width: 50 }] }, String(item.cantidad)),
            React.createElement(Text, { style: [s.tdCenter, { width: 70, fontSize: 9 }] }, 'Completo'),
            React.createElement(View, { style: { width: 60, alignItems: 'center' } },
              React.createElement(View, { style: s.checkbox }),
            ),
          )
        ),

        // Firmas
        React.createElement(View, { style: s.firmaSection },
          React.createElement(View, { style: { flex: 1, gap: 8 } },
            React.createElement(View, { style: s.firmaLine }),
            React.createElement(Text, { style: s.firmaLabel }, 'Firma del receptor'),
            React.createElement(Text, { style: s.firmaSub }, 'Aclaración: _____________________'),
            React.createElement(Text, { style: s.firmaSub }, 'Fecha: ___/___/______'),
          ),
          React.createElement(View, { style: { flex: 1, gap: 8 } },
            React.createElement(View, { style: s.firmaLine }),
            React.createElement(Text, { style: s.firmaLabel }, 'Entregado por SU Home'),
            React.createElement(Text, { style: s.firmaSub }, 'Nombre: _____________________'),
            React.createElement(Text, { style: s.firmaSub }, 'DNI: _________________________'),
          ),
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
      'Content-Disposition': `attachment; filename="remito-${id}.pdf"`,
    },
  })
}
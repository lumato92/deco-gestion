// src/app/api/pdf/orden-compra/route.ts

import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28, alignItems: 'flex-start' },
  empresa: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0f766e' },
  subtitulo: { fontSize: 9, color: '#6b7280', marginTop: 3 },
  ocBox: { backgroundColor: '#f3f4f6', padding: 10, borderRadius: 4, alignItems: 'flex-end' },
  ocNumero: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#7c3aed' },
  ocLabel: { fontSize: 8, color: '#9ca3af', marginBottom: 2 },
  seccion: { marginBottom: 16 },
  label: { fontSize: 8, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 },
  valor: { fontSize: 10, color: '#111827' },
  grid2: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  col: { flex: 1 },
  divider: { borderBottom: '1 solid #e5e7eb', marginVertical: 16 },
  tabla: { marginBottom: 16 },
  tablaHeader: { flexDirection: 'row', backgroundColor: '#f9fafb', padding: '6 8', borderBottom: '1 solid #e5e7eb' },
  tablaRow: { flexDirection: 'row', padding: '6 8', borderBottom: '1 solid #f3f4f6' },
  thNombre: { flex: 3, fontSize: 8, color: '#6b7280', textTransform: 'uppercase' },
  thTipo: { flex: 1, fontSize: 8, color: '#6b7280', textTransform: 'uppercase' },
  thCant: { width: 60, fontSize: 8, color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' },
  thPrecio: { width: 70, fontSize: 8, color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' },
  thSubtotal: { width: 70, fontSize: 8, color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' },
  tdNombre: { flex: 3, fontSize: 9 },
  tdTipo: { flex: 1, fontSize: 9, color: '#6b7280' },
  tdCant: { width: 60, fontSize: 9, textAlign: 'right' },
  tdPrecio: { width: 70, fontSize: 9, textAlign: 'right' },
  tdSubtotal: { width: 70, fontSize: 9, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, padding: '8 8', backgroundColor: '#f9fafb', borderRadius: 4 },
  totalLabel: { fontSize: 10, color: '#6b7280', marginRight: 16 },
  totalValor: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#111827' },
  notasBox: { backgroundColor: '#fafafa', border: '1 solid #e5e7eb', padding: 10, borderRadius: 4, marginTop: 8 },
  notasText: { fontSize: 9, color: '#374151', lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#9ca3af' },
  estadoPago: { fontSize: 9, padding: '4 8', borderRadius: 4, marginTop: 4 },
})

function formatMontoPDF(n: number) {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatFechaPDF(f: string) {
  return new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = Number(searchParams.get('id'))
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const supabase = await createClient()

    const [compraRes, lineasRes] = await Promise.all([
      supabase.from('compras_con_total').select('*').eq('id', id).single(),
      supabase.from('lineas_compra').select('*').eq('compra_id', id).order('id'),
    ])

    const compra = compraRes.data
    const lineas = lineasRes.data ?? []

    if (!compra) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    const total = lineas.reduce((s: number, l: any) => s + l.cantidad_pedida * l.precio_unitario, 0)

    const TIPO_LABEL: Record<string, string> = {
      insumo: 'Insumo', producto: 'Producto', otro: 'Otro',
    }
    const PAGO_LABEL: Record<string, string> = {
      pendiente: 'Pendiente de pago', pagado: 'Pagado', parcial: 'Pago parcial',
    }

    const buffer = await renderToBuffer(
      React.createElement(Document, { title: `Orden de Compra ${compra.numero_oc}` },
        React.createElement(Page, { size: 'A4', style: styles.page },

          // Header
          React.createElement(View, { style: styles.header },
            React.createElement(View, null,
              React.createElement(Text, { style: styles.empresa }, 'SU Home'),
              React.createElement(Text, { style: styles.subtitulo }, 'Decoración & Diseño'),
              React.createElement(Text, { style: { ...styles.subtitulo, marginTop: 8, color: '#374151' } }, `Fecha: ${formatFechaPDF(compra.fecha)}`),
            ),
            React.createElement(View, { style: styles.ocBox },
              React.createElement(Text, { style: styles.ocLabel }, 'ORDEN DE COMPRA'),
              React.createElement(Text, { style: styles.ocNumero }, compra.numero_oc ?? `#${compra.id}`),
            )
          ),

          // Proveedor
          React.createElement(View, { style: styles.grid2 },
            React.createElement(View, { style: styles.col },
              React.createElement(Text, { style: styles.label }, 'Proveedor'),
              React.createElement(Text, { style: { ...styles.valor, fontFamily: 'Helvetica-Bold' } }, compra.proveedor_nombre ?? '—'),
            ),
            React.createElement(View, { style: styles.col },
              React.createElement(Text, { style: styles.label }, 'Condición de pago'),
              React.createElement(Text, { style: styles.valor }, PAGO_LABEL[compra.estado_pago] ?? compra.estado_pago),
            ),
          ),

          React.createElement(View, { style: styles.divider }),

          // Tabla artículos
          React.createElement(View, { style: styles.tabla },
            React.createElement(View, { style: styles.tablaHeader },
              React.createElement(Text, { style: styles.thNombre }, 'Artículo'),
              React.createElement(Text, { style: styles.thTipo }, 'Tipo'),
              React.createElement(Text, { style: styles.thCant }, 'Cantidad'),
              React.createElement(Text, { style: styles.thPrecio }, 'Precio unit.'),
              React.createElement(Text, { style: styles.thSubtotal }, 'Subtotal'),
            ),
            ...lineas.map((l: any) =>
              React.createElement(View, { key: l.id, style: styles.tablaRow },
                React.createElement(Text, { style: styles.tdNombre }, l.nombre),
                React.createElement(Text, { style: styles.tdTipo }, TIPO_LABEL[l.tipo_destino] ?? l.tipo_destino),
                React.createElement(Text, { style: styles.tdCant }, `${l.cantidad_pedida}`),
                React.createElement(Text, { style: styles.tdPrecio }, formatMontoPDF(l.precio_unitario)),
                React.createElement(Text, { style: styles.tdSubtotal }, formatMontoPDF(l.cantidad_pedida * l.precio_unitario)),
              )
            ),
            React.createElement(View, { style: styles.totalRow },
              React.createElement(Text, { style: styles.totalLabel }, 'TOTAL DEL PEDIDO'),
              React.createElement(Text, { style: styles.totalValor }, formatMontoPDF(total)),
            )
          ),

          // Notas
          compra.notas ? React.createElement(View, null,
            React.createElement(Text, { style: styles.label }, 'Observaciones'),
            React.createElement(View, { style: styles.notasBox },
              React.createElement(Text, { style: styles.notasText }, compra.notas),
            )
          ) : null,

          // Footer
          React.createElement(View, { style: styles.footer },
            React.createElement(Text, { style: styles.footerText }, `Generado el ${new Date().toLocaleDateString('es-AR')}`),
            React.createElement(Text, { style: styles.footerText }, `${compra.numero_oc} — Uso interno`),
          )
        )
      )
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="OC-${compra.numero_oc ?? id}.pdf"`,
      },
    })
  } catch (e) {
    console.error('Error generando PDF OC:', e)
    return NextResponse.json({ error: 'Error generando PDF' }, { status: 500 })
  }
}
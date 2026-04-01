// src/app/api/pdf/presupuesto/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { PresupuestoPDF } from '@/lib/pdf/presupuesto'
import React from 'react'

export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = Number(searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const supabase = await createClient()

  const [pedidoRes, itemsRes] = await Promise.all([
    supabase
      .from('pedidos')
      .select(`
        id, fecha_pedido, notas, descuento_pct, canal_venta,
        fecha_entrega, fecha_compromiso_fabricacion,
        clientes (nombre, telefono, email)
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('items_pedido')
      .select('nombre_producto, cantidad, precio_unitario')
      .eq('pedido_id', id),
  ])

  if (!pedidoRes.data) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  const pedido = pedidoRes.data as any
  const items = itemsRes.data ?? []

  const subtotal = items.reduce(
    (s: number, i: any) => s + i.cantidad * i.precio_unitario, 0
  )
  const descuento = pedido.descuento_pct ?? 0
  const totalFinal = subtotal * (1 - descuento / 100)
  const adelanto = Math.round(totalFinal / 2)

  const fechaPedido = new Date(pedido.fecha_pedido)
  const validoHasta = new Date(fechaPedido)
  validoHasta.setDate(validoHasta.getDate() + 14)

  const fmt = (d: Date) =>
    d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

  const buffer = await renderToBuffer(
    React.createElement(PresupuestoPDF, {
      numero: pedido.id,
      fecha: fmt(fechaPedido),
      validoHasta: fmt(validoHasta),
      cliente: {
        nombre: pedido.clientes?.nombre ?? 'Sin nombre',
        telefono: pedido.clientes?.telefono,
        email: pedido.clientes?.email,
        canal: pedido.canal_venta,
      },
      items: items.map((i: any) => ({
        nombre_producto: i.nombre_producto,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      })),
      descuento_pct: descuento,
      notas: pedido.notas ?? undefined,
      fecha_entrega: pedido.fecha_entrega
        ? fmt(new Date(pedido.fecha_entrega))
        : undefined,
      tipo_entrega: pedido.fecha_compromiso_fabricacion ? 'fabricacion' : 'stock',
      adelanto: pedido.fecha_compromiso_fabricacion ? adelanto : undefined,
    })
  )

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="presupuesto-${id}.pdf"`,
    },
  })
}
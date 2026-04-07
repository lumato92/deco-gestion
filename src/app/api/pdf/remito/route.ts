// src/app/api/pdf/remito/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { RemitoPDF } from '@/lib/pdf/remito'
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
        id, fecha_pedido, estado, canal_venta, metodo_pago,
        clientes (nombre, telefono)
      `)
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

  const estadoPago = pedido.estado === 'entregado'
    ? 'Saldo pagado'
    : pedido.estado === 'confirmado'
      ? 'Pendiente de cobro'
      : 'Parcialmente pagado'

  const modalidad = pedido.canal_venta === 'tienda'
    ? 'Retiro en tienda'
    : 'Envío a domicilio'

  const fecha = new Date(pedido.fecha_pedido).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const buffer = await renderToBuffer(
    React.createElement(RemitoPDF, {
      numero: id,
      fecha,
      pedido_id: id,
      cliente: {
        nombre: pedido.clientes?.nombre ?? 'Sin nombre',
        telefono: pedido.clientes?.telefono,
      },
      items: (itemsRes.data ?? []).map((i: any) => ({
        nombre_producto: i.nombre_producto,
        cantidad: i.cantidad,
      })),
      modalidad_entrega: modalidad,
      estado_pago: estadoPago,
    })
  )

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="remito-${id}.pdf"`,
    },
  })
}
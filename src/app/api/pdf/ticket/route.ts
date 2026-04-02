// src/app/api/pdf/ticket/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { TicketPDF } from '@/lib/pdf/ticket'
import React from 'react'

export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = Number(searchParams.get('id'))
  const mensaje = searchParams.get('mensaje') ?? undefined

  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const supabase = await createClient()

  const [pedidoRes, itemsRes] = await Promise.all([
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

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ticket-regalo-${id}.pdf"`,
    },
  })
}
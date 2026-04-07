// src/app/api/pagos/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@/lib/supabase/client'

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // MP manda distintos tipos de notificación, solo nos interesa "payment"
    if (body.type !== 'payment') {
      return NextResponse.json({ ok: true })
    }

    const payment = new Payment(client)
    const pago = await payment.get({ id: body.data.id })

    // Solo procesamos pagos aprobados
    if (pago.status !== 'approved') {
      return NextResponse.json({ ok: true })
    }

    const pedidoId = Number(pago.external_reference)
    const monto = pago.transaction_amount ?? 0

    if (!pedidoId || isNaN(pedidoId)) {
      return NextResponse.json({ error: 'external_reference inválido' }, { status: 400 })
    }

    const supabase = createClient()

    // Registramos el pago en pagos_pedido
    const { error: errPago } = await supabase.from('pagos_pedido').insert({
      pedido_id: pedidoId,
      tipo: 'saldo',
      metodo_pago: 'mercadopago',
      monto,
      notas: `Pago MP #${pago.id}`,
    })

    if (errPago) throw new Error(errPago.message)

    // Verificamos si el pedido quedó saldado
    const { data: pedido } = await supabase
      .from('pedidos_con_total')
      .select('pendiente')
      .eq('id', pedidoId)
      .single()

    if (pedido && pedido.pendiente <= 0) {
      await supabase
        .from('pedidos')
        .update({ estado: 'entregado' })
        .eq('id', pedidoId)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webhook MP error:', error)
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 })
  }
}
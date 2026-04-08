// src/app/api/pagos/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@/lib/supabase/server'

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.type !== 'payment') {
      return NextResponse.json({ ok: true })
    }

    const payment = new Payment(client)
    const pago = await payment.get({ id: body.data.id })

    if (pago.status !== 'approved') {
      return NextResponse.json({ ok: true })
    }

    const supabase = await createClient()

    // ── Calcular comisiones ───────────────────────────────────
    const montobruto = pago.transaction_amount ?? 0
    const comisiones = (pago.fee_details as any[])?.reduce(
      (s: number, f: any) => s + (f.amount ?? 0), 0
    ) ?? 0
    const neto = (pago as any).net_amount ?? montobruto - comisiones
    const medio = pago.payment_method_id ?? null
    const cuotas = pago.installments ?? 1

    // ── Detectar si es pago del Point (sin external_reference) ─
    const externalRef = pago.external_reference
    const esPagoPoint = !externalRef || externalRef === '' || externalRef === 'null'

    if (esPagoPoint) {
      // Guardar en pagos_point_pendientes para asignación manual
      const { error: errPoint } = await supabase
        .from('pagos_point_pendientes')
        .insert({
          mp_pago_id: String(pago.id),
          monto: montobruto,
          monto_neto: neto,
          comisiones,
          medio,
          cuotas,
          estado: 'pendiente',
          fecha_pago: pago.date_approved ?? new Date().toISOString(),
          datos_raw: pago,
        })

      if (errPoint) throw new Error(errPoint.message)
      return NextResponse.json({ ok: true, tipo: 'point_pendiente' })
    }

    // ── Pago online con external_reference (flujo normal) ─────
    const pedidoId = Number(externalRef)
    if (!pedidoId || isNaN(pedidoId)) {
      return NextResponse.json({ error: 'external_reference inválido' }, { status: 400 })
    }

    const { error: errPago } = await supabase.from('pagos_pedido').insert({
      pedido_id: pedidoId,
      tipo: 'saldo',
      metodo_pago: 'mercadopago',
      monto: montobruto,
      notas: `Pago MP #${pago.id} · Neto $${neto} · Comisiones $${comisiones}`,
    })

    if (errPago) throw new Error(errPago.message)

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

    return NextResponse.json({ ok: true, tipo: 'pago_online' })
  } catch (error) {
    console.error('Webhook MP error:', error)
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 })
  }
}
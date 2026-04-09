// src/app/api/pagos/point/asignar/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { mp_pago_id, pedido_id } = await req.json()

    if (!mp_pago_id || !pedido_id) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const supabase = createClient()

    // Traemos el pago Point pendiente
    const { data: pagoPoint, error: errGet } = await supabase
      .from('pagos_point_pendientes')
      .select('*')
      .eq('mp_pago_id', String(mp_pago_id))
      .eq('estado', 'pendiente')
      .single()

    if (errGet || !pagoPoint) {
      return NextResponse.json({ error: 'Pago no encontrado o ya asignado' }, { status: 404 })
    }

    // Registramos en pagos_pedido
    const { error: errPago } = await supabase.from('pagos_pedido').insert({
      pedido_id,
      tipo: 'saldo',
      metodo_pago: 'debito', // se pisa con el medio real si está disponible
      monto: pagoPoint.monto,
      notas: `Point MP #${mp_pago_id} · Neto $${pagoPoint.monto_neto} · Comisiones $${pagoPoint.comisiones}`,
    })

    if (errPago) throw new Error(errPago.message)

    // Marcamos el pago Point como asignado
    const { error: errUpdate } = await supabase
      .from('pagos_point_pendientes')
      .update({ estado: 'asignado', pedido_id })
      .eq('mp_pago_id', String(mp_pago_id))

    if (errUpdate) throw new Error(errUpdate.message)

    // Verificamos si el pedido quedó saldado
    const { data: pedido } = await supabase
      .from('pedidos_con_total')
      .select('pendiente')
      .eq('id', pedido_id)
      .single()

    if (pedido && pedido.pendiente <= 0) {
      await supabase
        .from('pedidos')
        .update({ estado: 'entregado' })
        .eq('id', pedido_id)
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Error asignando pago Point:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Error al asignar el pago' },
      { status: 500 }
    )
  }
}
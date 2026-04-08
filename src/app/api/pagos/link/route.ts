// src/app/api/pagos/link/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { createClient } from '@/lib/supabase/server'

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

const preference = new Preference(client)

export async function POST(req: NextRequest) {
  try {
    const { pedido_id, descripcion, monto, email_cliente } = await req.json()

    const result = await preference.create({
      body: {
        items: [
          {
            id: String(pedido_id),
            title: descripcion ?? `Pedido #${pedido_id}`,
            quantity: 1,
            currency_id: 'ARS',
            unit_price: monto,
          },
        ],
        payer: {
          email: email_cliente ?? 'cliente@email.com',
        },
        external_reference: String(pedido_id),
      },
    })

    const link = result.init_point

    if (!link) {
      return NextResponse.json({ error: 'MP no devolvió un link' }, { status: 500 })
    }

    // Guardamos el link en la DB para poder reenviarlo sin regenerar
    const supabase = await createClient()
    await supabase
      .from('pedidos')
      .update({ mp_link: link })
      .eq('id', pedido_id)

    return NextResponse.json({ link })
  } catch (error: any) {
    console.error('Error creando preferencia MP:', error)
    return NextResponse.json({
      error: 'No se pudo generar el link',
      detalle: error?.message ?? String(error),
    }, { status: 500 })
  }
}
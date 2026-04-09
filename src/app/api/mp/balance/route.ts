// src/app/api/mp/balance/route.ts

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch('https://api.mercadopago.com/v1/account/balance', {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error('Error al obtener balance MP')
    const data = await res.json()
    return NextResponse.json({
      available_balance: data.available_balance ?? 0,
      unavailable_balance: data.unavailable_balance ?? 0,
      total_amount: data.total_amount ?? 0,
    })
  } catch {
    return NextResponse.json({ available_balance: 0, unavailable_balance: 0, total_amount: 0 })
  }
}
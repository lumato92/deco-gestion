// src/app/api/ml/oauth/iniciar/route.ts
//
// T3 — Arranca el flujo OAuth (Authorization Code, server side).
// El botón "Conectar Mercado Libre" de la UI (T7) apunta acá.

import { NextResponse } from 'next/server'
import { COOKIE_STATE } from '@/lib/ml/oauth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AUTORIZACION = 'https://auth.mercadolibre.com.ar/authorization'

export async function GET() {
  const clientId = process.env.ML_CLIENT_ID
  const redirectUri = process.env.ML_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Faltan ML_CLIENT_ID o ML_REDIRECT_URI en el entorno' },
      { status: 500 }
    )
  }

  // state: valor random que vuelve tal cual desde ML. Sirve para verificar que
  // el callback corresponde a un flujo que arrancamos nosotros y no a un link
  // que alguien le pasó a Lucas para conectar OTRA cuenta a nuestra app.
  const state = crypto.randomUUID()

  const url = new URL(AUTORIZACION)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)

  const respuesta = NextResponse.redirect(url.toString())
  respuesta.cookies.set(COOKIE_STATE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutos: el flujo dura segundos
  })

  return respuesta
}

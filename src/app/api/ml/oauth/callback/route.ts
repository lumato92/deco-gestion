// src/app/api/ml/oauth/callback/route.ts
//
// T3 — Cierre del flujo OAuth: ML nos manda acá con un `code` de un solo uso,
// lo canjeamos por el par access_token / refresh_token y lo guardamos.
//
// El redirect_uri configurado en el panel de ML tiene que apuntar exactamente
// a esta ruta, carácter por carácter.

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { guardarCredencial, pedirToken } from '@/lib/ml/credenciales'
import { enviarAlerta } from '@/lib/ml/alertas'
import { COOKIE_STATE, RUTA_INTEGRACION } from '@/lib/ml/oauth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Trae el nickname para mostrar qué cuenta quedó conectada. Best-effort. */
async function nicknameDe(accessToken: string): Promise<string | null> {
  try {
    const r = await fetch('https://api.mercadolibre.com/users/me', {
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!r.ok) return null
    const usuario = (await r.json()) as { nickname?: string }
    return usuario.nickname ?? null
  } catch {
    return null
  }
}

function volverA(req: NextRequest, params: Record<string, string>) {
  const destino = new URL(RUTA_INTEGRACION, req.nextUrl.origin)
  for (const [k, v] of Object.entries(params)) destino.searchParams.set(k, v)

  const respuesta = NextResponse.redirect(destino.toString())
  respuesta.cookies.delete(COOKIE_STATE)
  return respuesta
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const code = params.get('code')
  const state = params.get('state')
  const errorML = params.get('error')

  // El usuario canceló, o ML rechazó los permisos.
  if (errorML) {
    return volverA(req, { estado: 'error', motivo: params.get('error_description') ?? errorML })
  }

  if (!code) {
    return volverA(req, { estado: 'error', motivo: 'ML no devolvió el code de autorización' })
  }

  // Verificación del state: tiene que coincidir con el que emitimos.
  const stateEsperado = req.cookies.get(COOKIE_STATE)?.value
  if (!stateEsperado || state !== stateEsperado) {
    return volverA(req, {
      estado: 'error',
      motivo: 'El state no coincide. Volvé a empezar la conexión desde la app.',
    })
  }

  const clientId = process.env.ML_CLIENT_ID
  const clientSecret = process.env.ML_CLIENT_SECRET
  const redirectUri = process.env.ML_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return volverA(req, { estado: 'error', motivo: 'Faltan variables de entorno de ML' })
  }

  try {
    const token = await pedirToken({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    })

    const nickname = await nicknameDe(token.access_token)
    await guardarCredencial(createAdminClient(), token, nickname)

    // Si el scope no trae offline_access no hay refresh_token utilizable a
    // futuro: conviene enterarse ahora y no dentro de seis horas.
    if (!token.scope?.includes('offline_access')) {
      await enviarAlerta({
        nivel: 'atencion',
        titulo: 'Mercado Libre conectado sin offline_access',
        detalle:
          'La cuenta quedó conectada pero el scope no incluye offline_access, así que el token no se va a poder renovar solo. Revisá los permisos de la app en el panel de ML.',
        contexto: { scope: token.scope },
      })
    }

    console.log('[ml][oauth] cuenta conectada', { seller_id: token.user_id, nickname })

    return volverA(req, { estado: 'conectado', cuenta: nickname ?? String(token.user_id) })
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e)
    console.error('[ml][oauth] falló el canje del code:', motivo)
    return volverA(req, { estado: 'error', motivo })
  }
}

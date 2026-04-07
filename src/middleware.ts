// src/middleware.ts
// Protege todas las rutas del dashboard

import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'deco_session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas — no requieren login
  const rutasPublicas = ['/login', '/api/auth/login','api/pagos/webhook']
  if (rutasPublicas.some(r => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // Verificar que existe la cookie de sesión
  const token = request.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    // Redirigir al login guardando la ruta original
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Decodificar sesión para verificar rol en rutas restringidas
  try {
    const secret = process.env.AUTH_SECRET ?? 'deco-secret-default'
    const [payload, firma] = token.split('.')
    const firmaEsperada = Buffer.from(`${payload}.${secret}`).toString('base64').slice(0, 16)

    if (firma !== firmaEsperada) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'))
    const rol = data.rol as string

    // Rutas restringidas a root/admin
    const rutasAdmin = [
      '/dashboard/insumos',
      '/dashboard/gastos',
      '/dashboard/finanzas',
      '/dashboard/usuarios',
    ]

    const rutaRestringida = rutasAdmin.some(r => pathname.startsWith(r))
    if (rutaRestringida && rol === 'user') {
      // Redirigir al dashboard con mensaje de error
      const dashboardUrl = new URL('/dashboard', request.url)
      dashboardUrl.searchParams.set('error', 'sin_permiso')
      return NextResponse.redirect(dashboardUrl)
    }

    return NextResponse.next()
  } catch {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
}
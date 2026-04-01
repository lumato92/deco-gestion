// src/app/api/auth/me/route.ts

import { NextResponse } from 'next/server'
import { getSesion } from '@/lib/auth'

export async function GET() {
  const sesion = await getSesion()
  if (!sesion) {
    return NextResponse.json({ usuario: null })
  }
  return NextResponse.json({ usuario: sesion })
}
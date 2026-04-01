// src/app/api/auth/logout/route.ts

import { NextResponse } from 'next/server'
import { deleteSesion } from '@/lib/auth'

export async function POST() {
  await deleteSesion()
  return NextResponse.json({ ok: true })
}
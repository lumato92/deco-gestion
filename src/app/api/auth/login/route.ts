// src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { setSesion, type UsuarioSesion } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuario y contraseña requeridos' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, username, password, nombre, rol, activo')
      .eq('username', username.trim().toLowerCase())
      .single()

    if (error || !usuario) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      )
    }

    if (!usuario.activo) {
      return NextResponse.json(
        { error: 'Tu cuenta está desactivada. Contactá al administrador.' },
        { status: 403 }
      )
    }

    const passwordValida = await bcrypt.compare(password, usuario.password)

    if (!passwordValida) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      )
    }

    const sesion: UsuarioSesion = {
      id: usuario.id,
      username: usuario.username,
      nombre: usuario.nombre,
      rol: usuario.rol,
    }

    await setSesion(sesion)

    return NextResponse.json({ ok: true, usuario: sesion })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
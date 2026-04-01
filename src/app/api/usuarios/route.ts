// src/app/api/usuarios/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    // Verificar sesión
    const sesion = await getSesion()

    if (!sesion) {
      return NextResponse.json(
        { error: 'No hay sesión activa. Volvé a iniciar sesión.' },
        { status: 401 }
      )
    }

    if (sesion.rol !== 'root') {
      return NextResponse.json(
        { error: 'Solo el usuario root puede crear usuarios.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { nombre, username, password, rol } = body

    if (!nombre || !username || !password || !rol) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios' },
        { status: 400 }
      )
    }

    if (!['admin', 'user'].includes(rol)) {
      return NextResponse.json(
        { error: 'Rol inválido. Debe ser admin o user.' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verificar que el username no exista
    const { data: existente } = await supabase
      .from('usuarios')
      .select('id')
      .eq('username', username.toLowerCase().trim())
      .maybeSingle()

    if (existente) {
      return NextResponse.json(
        { error: 'El nombre de usuario ya está en uso' },
        { status: 409 }
      )
    }

    // Hashear contraseña
    const hash = await bcrypt.hash(password, 10)

    const { error: insertError } = await supabase
      .from('usuarios')
      .insert({
        username: username.toLowerCase().trim(),
        password: hash,
        nombre: nombre.trim(),
        rol,
        activo: true,
        creado_por: sesion.id,
      })

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })

  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const sesion = await getSesion()

    if (!sesion) {
      return NextResponse.json(
        { error: 'No hay sesión activa. Volvé a iniciar sesión.' },
        { status: 401 }
      )
    }

    if (sesion.rol !== 'root') {
      return NextResponse.json(
        { error: 'Solo el usuario root puede editar usuarios.' },
        { status: 403 }
      )
    }

    const { id, nombre, username, password, rol } = await req.json()

    if (!id || !nombre || !username || !rol) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verificar que el username no esté tomado por otro
    const { data: existente } = await supabase
      .from('usuarios')
      .select('id')
      .eq('username', username.toLowerCase().trim())
      .neq('id', id)
      .maybeSingle()

    if (existente) {
      return NextResponse.json(
        { error: 'El nombre de usuario ya está en uso' },
        { status: 409 }
      )
    }

    const updates: Record<string, any> = {
      nombre: nombre.trim(),
      username: username.toLowerCase().trim(),
      rol,
      updated_at: new Date().toISOString(),
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'La contraseña debe tener al menos 6 caracteres' },
          { status: 400 }
        )
      }
      updates.password = await bcrypt.hash(password, 10)
    }

    const { error: updateError } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })

  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
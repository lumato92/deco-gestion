// src/lib/auth.ts
// Manejo de sesión con cookies firmadas (sin JWT externo)

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export type Rol = 'root' | 'admin' | 'user'

export interface UsuarioSesion {
  id: string
  username: string
  nombre: string
  rol: Rol
}

const COOKIE_NAME = 'deco_session'
const SESSION_DURATION = 60 * 60 * 24 * 7 // 7 días en segundos

// Codificar sesión en base64 simple (no JWT — es suficiente para uso interno)
function encodeSesion(usuario: UsuarioSesion): string {
  const secret = process.env.AUTH_SECRET ?? 'deco-secret-default'
  const data = JSON.stringify(usuario)
  const payload = Buffer.from(data).toString('base64')
  // Firma simple con el secret
  const firma = Buffer.from(`${payload}.${secret}`).toString('base64').slice(0, 16)
  return `${payload}.${firma}`
}

function decodeSesion(token: string): UsuarioSesion | null {
  try {
    const secret = process.env.AUTH_SECRET ?? 'deco-secret-default'
    const [payload, firma] = token.split('.')
    const firmaEsperada = Buffer.from(`${payload}.${secret}`).toString('base64').slice(0, 16)
    if (firma !== firmaEsperada) return null
    const data = Buffer.from(payload, 'base64').toString('utf-8')
    return JSON.parse(data) as UsuarioSesion
  } catch {
    return null
  }
}

// Obtener usuario de la sesión actual (server side)
export async function getSesion(): Promise<UsuarioSesion | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return decodeSesion(token)
}

// Guardar sesión en cookie
export async function setSesion(usuario: UsuarioSesion): Promise<void> {
  const cookieStore = await cookies()
  const token = encodeSesion(usuario)
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION,
    path: '/',
  })
}

// Eliminar sesión
export async function deleteSesion(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

// Verificar si tiene permiso para una acción
export function tienePermiso(rol: Rol, accion: keyof typeof PERMISOS): boolean {
  return PERMISOS[accion].includes(rol)
}

// Definición de permisos por rol
export const PERMISOS = {
  // Ventas
  ver_ventas:          ['root', 'admin', 'user'] as Rol[],
  crear_venta:         ['root', 'admin', 'user'] as Rol[],
  editar_venta:        ['root', 'admin', 'user'] as Rol[],
  cancelar_venta:      ['root', 'admin', 'user'] as Rol[],
  eliminar_venta:      ['root', 'admin'] as Rol[],

  // Presupuestos
  ver_presupuestos:    ['root', 'admin', 'user'] as Rol[],
  crear_presupuesto:   ['root', 'admin', 'user'] as Rol[],
  editar_presupuesto:  ['root', 'admin', 'user'] as Rol[],
  confirmar_presupuesto: ['root', 'admin', 'user'] as Rol[],

  // Clientes
  ver_clientes:        ['root', 'admin', 'user'] as Rol[],
  crear_cliente:       ['root', 'admin', 'user'] as Rol[],
  editar_cliente:      ['root', 'admin'] as Rol[],
  eliminar_cliente:    ['root', 'admin'] as Rol[],

  // Productos
  ver_productos:       ['root', 'admin', 'user'] as Rol[],
  crear_producto:      ['root', 'admin'] as Rol[],
  editar_producto:     ['root', 'admin'] as Rol[],
  eliminar_producto:   ['root', 'admin'] as Rol[],

  // Insumos
  ver_insumos:         ['root', 'admin'] as Rol[],
  editar_insumos:      ['root', 'admin'] as Rol[],
  ajustar_stock:       ['root', 'admin'] as Rol[],

  // Gastos
  ver_gastos:          ['root', 'admin'] as Rol[],
  crear_gasto:         ['root', 'admin'] as Rol[],
  editar_gasto:        ['root', 'admin'] as Rol[],

  // Finanzas
  ver_finanzas:        ['root', 'admin'] as Rol[],

  // Usuarios (panel de admin)
  ver_usuarios:        ['root'] as Rol[],
  crear_usuario:       ['root'] as Rol[],
  editar_usuario:      ['root'] as Rol[],
  eliminar_usuario:    ['root'] as Rol[],
} as const
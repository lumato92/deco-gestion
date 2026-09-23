// src/app/api/ml/publicaciones/route.ts
//
// Vínculo publicación de ML ↔ producto interno.
//
// GET: publicaciones activas en ML + a qué producto apunta cada una + cuántas
//      ventas viejas quedaron sin descontar stock por publicación.
// PUT: vincula (o desvincula) una publicación. Solo afecta ventas futuras; las
//      pasadas se concilian aparte desde /api/ml/conciliar, con simulación.
//
// Requiere login: no está en las rutas públicas del middleware.

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { leerCredencial } from '@/lib/ml/credenciales'
import { listarPublicacionesActivas } from '@/lib/ml/publicaciones'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Vinculo {
  ml_item_id: string
  producto_id: number
  titulo: string | null
}

export async function GET() {
  const supabase = createAdminClient()

  try {
    const credencial = await leerCredencial(supabase)
    const activas = await listarPublicacionesActivas(supabase, credencial.seller_id)

    const [vinculos, productos, pendientes] = await Promise.all([
      supabase.from('ml_publicaciones').select('ml_item_id, producto_id, titulo'),
      supabase
        .from('productos')
        .select('id, nombre, stock, es_kit')
        .eq('estado', 'activo')
        .order('nombre'),
      // Líneas de ventas ML sin producto: se cuentan por publicación.
      supabase
        .from('items_pedido')
        .select('ml_item_id, cantidad, pedidos!inner(canal_venta, estado)')
        .is('producto_id', null)
        .not('ml_item_id', 'is', null)
        .eq('pedidos.canal_venta', 'mercadolibre')
        .neq('pedidos.estado', 'cancelado'),
    ])

    const error = vinculos.error ?? productos.error ?? pendientes.error
    if (error) throw new Error(error.message)

    const vinculoDe = new Map<string, Vinculo>()
    for (const v of (vinculos.data ?? []) as Vinculo[]) vinculoDe.set(v.ml_item_id, v)

    const pendientesDe = new Map<string, number>()
    for (const p of (pendientes.data ?? []) as unknown as { ml_item_id: string; cantidad: number }[]) {
      pendientesDe.set(p.ml_item_id, (pendientesDe.get(p.ml_item_id) ?? 0) + p.cantidad)
    }

    const idsActivas = new Set(activas.map(a => a.id))

    const publicaciones = [
      ...activas.map(a => ({
        ml_item_id: a.id,
        titulo: a.title,
        precio: a.price,
        stock_ml: a.available_quantity,
        thumbnail: a.thumbnail ?? null,
        permalink: a.permalink ?? null,
        activa: true,
        producto_id: vinculoDe.get(a.id)?.producto_id ?? null,
        unidades_pendientes: pendientesDe.get(a.id) ?? 0,
      })),
      // Vínculos a publicaciones pausadas o cerradas: se listan igual para
      // poder desvincularlas y conciliar sus ventas viejas.
      ...[...vinculoDe.values()]
        .filter(v => !idsActivas.has(v.ml_item_id))
        .map(v => ({
          ml_item_id: v.ml_item_id,
          titulo: v.titulo ?? v.ml_item_id,
          precio: null,
          stock_ml: null,
          thumbnail: null,
          permalink: null,
          activa: false,
          producto_id: v.producto_id,
          unidades_pendientes: pendientesDe.get(v.ml_item_id) ?? 0,
        })),
    ]

    return NextResponse.json({ ok: true, publicaciones, productos: productos.data ?? [] })
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)
    console.error('[ml][publicaciones] error', mensaje)
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  let cuerpo: { ml_item_id?: string; producto_id?: number | null; titulo?: string }
  try {
    cuerpo = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  }

  const { ml_item_id, producto_id, titulo } = cuerpo
  if (!ml_item_id || !/^[A-Z]{3}\d+$/.test(ml_item_id)) {
    return NextResponse.json({ ok: false, error: 'ml_item_id inválido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error } = producto_id == null
    ? await supabase.from('ml_publicaciones').delete().eq('ml_item_id', ml_item_id)
    : await supabase
        .from('ml_publicaciones')
        .upsert({ ml_item_id, producto_id, titulo: titulo ?? null }, { onConflict: 'ml_item_id' })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

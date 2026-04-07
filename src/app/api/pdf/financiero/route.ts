// src/app/api/pdf/financiero/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { FinancieroPDF } from '@/lib/pdf/financiero'
import React from 'react'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || (sesion.rol !== 'root' && sesion.rol !== 'admin')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const mes = Number(searchParams.get('mes') ?? new Date().getMonth() + 1)
  const anio = Number(searchParams.get('anio') ?? new Date().getFullYear())

  if (!mes || !anio) {
    return NextResponse.json({ error: 'Mes y año requeridos' }, { status: 400 })
  }

  const supabase = await createClient()

  const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`
  const fin = new Date(anio, mes, 0).toISOString().split('T')[0]

  // Cargar ventas del mes (no canceladas)
  const { data: ventas } = await supabase
    .from('pedidos_con_total')
    .select('*')
    .gte('fecha_confirmacion', inicio)
    .lte('fecha_confirmacion', fin + 'T23:59:59')
    .not('estado', 'in', '("presupuesto","cancelado")')

  // Cargar gastos del mes
  const { data: gastos } = await supabase
    .from('gastos')
    .select('monto, categoria')
    .gte('fecha', inicio)
    .lte('fecha', fin)

  // Cargar top productos
  const { data: topItems } = await supabase
    .from('items_pedido')
    .select('nombre_producto, cantidad, precio_unitario, pedidos!inner(fecha_confirmacion, estado)')
    .gte('pedidos.fecha_confirmacion', inicio)
    .lte('pedidos.fecha_confirmacion', fin + 'T23:59:59')
    .not('pedidos.estado', 'in', '("presupuesto","cancelado")')

  const ventasData = ventas ?? []
  const gastosData = gastos ?? []
  const topData = topItems ?? []

  // Calcular totales
  const totalIngresos = ventasData.reduce((s: number, v: any) => s + (v.total_cobrado ?? 0), 0)
  const totalGastos = gastosData.reduce((s: number, g: any) => s + (g.monto ?? 0), 0)
  const cantidadVentas = ventasData.length
  const ticketPromedio = cantidadVentas > 0 ? Math.round(totalIngresos / cantidadVentas) : 0

  // Ingresos por canal
  const canalesMap: Record<string, number> = {}
  ventasData.forEach((v: any) => {
    const canal = v.canal_venta ?? 'directo'
    canalesMap[canal] = (canalesMap[canal] ?? 0) + (v.total_cobrado ?? 0)
  })
  const canales = Object.entries(canalesMap)
    .map(([canal, monto]) => ({
      canal: canal.charAt(0).toUpperCase() + canal.slice(1),
      monto,
      porcentaje: totalIngresos > 0 ? Math.round(monto / totalIngresos * 100) : 0,
    }))
    .sort((a, b) => b.monto - a.monto)

  // Gastos por categoría
  const categoriasMap: Record<string, number> = {}
  gastosData.forEach((g: any) => {
    const cat = g.categoria ?? 'Otros'
    categoriasMap[cat] = (categoriasMap[cat] ?? 0) + (g.monto ?? 0)
  })
  const gastosPorCategoria = Object.entries(categoriasMap)
    .map(([categoria, monto]) => ({
      categoria,
      monto,
      porcentaje: totalGastos > 0 ? Math.round(monto / totalGastos * 100) : 0,
    }))
    .sort((a, b) => b.monto - a.monto)

  // Top productos
  const productosMap: Record<string, { unidades: number; ingresos: number }> = {}
  topData.forEach((i: any) => {
    const nombre = i.nombre_producto
    if (!productosMap[nombre]) productosMap[nombre] = { unidades: 0, ingresos: 0 }
    productosMap[nombre].unidades += i.cantidad
    productosMap[nombre].ingresos += i.cantidad * i.precio_unitario
  })
  const topProductos = Object.entries(productosMap)
    .map(([nombre, data]) => ({ nombre, ...data }))
    .sort((a, b) => b.ingresos - a.ingresos)
    .slice(0, 8)

  const fechaGeneracion = new Date().toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const buffer = await renderToBuffer(
    React.createElement(FinancieroPDF, {
      mes: `${MESES[mes - 1]} ${anio}`,
      fechaGeneracion,
      ingresos: totalIngresos,
      gastos: totalGastos,
      cantidadVentas,
      ticketPromedio,
      canales,
      gastosPorCategoria,
      topProductos,
    })
  )

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="financiero-${MESES[mes - 1].toLowerCase()}-${anio}.pdf"`,
    },
  })
}
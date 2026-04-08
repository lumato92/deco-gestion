'use client'

// src/hooks/use-productos.ts

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'

export interface Producto {
  id: number
  nombre: string
  slug?: string
  tipo: 'propio' | 'reventa' | 'consignacion'
  categoria_id?: number
  subcategoria_id?: number
  categoria_nombre?: string
  subcategoria_nombre?: string
  stock: number
  costo: number
  precio: number
  minimo: number
  es_kit: boolean
  publicado: boolean
  destacado: boolean
  estado: 'activo' | 'pausado' | 'descontinuado'
  descripcion_corta?: string
  descripcion_larga?: string
  variante_nombre?: string
  orden_catalogo: number
  margen_pct?: number
  estado_stock?: 'ok' | 'medio' | 'bajo'
  imagen_principal?: string
}

export interface FiltrosProductos {
  busqueda: string
  categoria_id: number | ''
  tipo: string
  estado_stock: string
  publicado: string
}

const FILTROS_INICIALES: FiltrosProductos = {
  busqueda: '',
  categoria_id: '',
  tipo: '',
  estado_stock: '',
  publicado: '',
}

function normalizar(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function useProductos() {
  const [todos, setTodos] = useState<Producto[]>([])
  const [filtros, setFiltrosState] = useState<FiltrosProductos>(FILTROS_INICIALES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProductos = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    const { data, error: err } = await supabase
      .from('productos_con_margen')
      .select('*')
      .order('orden_catalogo', { ascending: true })
      .order('nombre', { ascending: true })
    if (err) setError('Error al cargar productos')
    else setTodos(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProductos() }, [fetchProductos])

  useRealtime({
    tablas: ['productos', 'recetas', 'insumos', 'imagenes_producto'],
    onCambio: fetchProductos,
  })

  const setFiltros = useCallback((f: Partial<FiltrosProductos>) => {
    setFiltrosState(prev => ({ ...prev, ...f }))
  }, [])

  const limpiarFiltros = useCallback(() => setFiltrosState(FILTROS_INICIALES), [])

  // Filtrado local
  const productos = todos.filter(p => {
    if (filtros.busqueda) {
      const q = normalizar(filtros.busqueda)
      if (!normalizar(p.nombre).includes(q)) return false
    }
    if (filtros.categoria_id !== '' && p.categoria_id !== filtros.categoria_id) return false
    if (filtros.tipo && p.tipo !== filtros.tipo) return false
    if (filtros.estado_stock && p.estado_stock !== filtros.estado_stock) return false
    if (filtros.publicado !== '') {
      const pub = filtros.publicado === 'true'
      if (p.publicado !== pub) return false
    }
    return true
  })

  // Estadísticas
  const stats = {
    total: todos.length,
    stockBajo: todos.filter(p => p.estado_stock === 'bajo').length,
    sinPublicar: todos.filter(p => !p.publicado).length,
    valorStock: todos.reduce((s, p) => s + p.stock * p.costo, 0),
  }

  // ── Ajuste de stock ───────────────────────────────────────
  const ajustarStock = useCallback(async (
    id: number,
    operacion: 'entrada' | 'salida' | 'ajuste',
    cantidad: number,
    nuevoCosto?: number
  ): Promise<boolean> => {
    const supabase = createClient()
    try {
      const producto = todos.find(p => p.id === id)
      if (!producto) return false

      let nuevoStock: number
      if (operacion === 'entrada') nuevoStock = producto.stock + cantidad
      else if (operacion === 'salida') nuevoStock = Math.max(0, producto.stock - cantidad)
      else nuevoStock = cantidad // ajuste manual = nuevo total

      const update: Record<string, number> = { stock: nuevoStock }
      if (operacion === 'entrada' && nuevoCosto !== undefined) {
        update.costo = nuevoCosto
      }

      const { error: err } = await supabase
        .from('productos')
        .update(update)
        .eq('id', id)

      if (err) throw err
      await fetchProductos()
      return true
    } catch {
      return false
    }
  }, [todos, fetchProductos])

  return {
    productos, todos, stats, loading, error,
    filtros, setFiltros, limpiarFiltros,
    recargar: fetchProductos,
    ajustarStock,
  }
}

// ── Hook para un producto individual ─────────────────────────

export function useProducto(id: number | null) {
  const [producto, setProducto] = useState<Producto | null>(null)
  const [categorias, setCategorias] = useState<any[]>([])
  const [subcategorias, setSubcategorias] = useState<any[]>([])
  const [receta, setReceta] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const cargar = async () => {
      setLoading(true)
      const [catRes, prodRes, recetaRes] = await Promise.all([
        supabase.from('categorias').select('id, nombre, icono, color').order('orden'),
        id ? supabase.from('productos_con_margen').select('*').eq('id', id).single() : Promise.resolve({ data: null }),
        id ? supabase.from('recetas_detalle').select('*').eq('producto_id', id) : Promise.resolve({ data: [] }),
      ])
      setCategorias(catRes.data ?? [])
      if (prodRes.data) setProducto(prodRes.data)
      setReceta(recetaRes.data ?? [])
      setLoading(false)
    }
    cargar()
  }, [id])

  const cargarSubcategorias = useCallback(async (categoriaId: number) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('subcategorias')
      .select('id, nombre')
      .eq('categoria_id', categoriaId)
      .order('orden')
    setSubcategorias(data ?? [])
  }, [])

  useEffect(() => {
    if (producto?.categoria_id) cargarSubcategorias(producto.categoria_id)
  }, [producto?.categoria_id, cargarSubcategorias])

  const guardar = useCallback(async (datos: Partial<Producto>): Promise<boolean> => {
    const supabase = createClient()
    setGuardando(true)
    setError(null)
    try {
      if (id) {
        const { error: err } = await supabase.from('productos').update(datos).eq('id', id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('productos').insert(datos)
        if (err) throw err
      }
      return true
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar')
      return false
    } finally {
      setGuardando(false)
    }
  }, [id])

  const eliminar = useCallback(async (): Promise<boolean> => {
    if (!id) return false
    const supabase = createClient()
    const { error: err } = await supabase.from('productos').delete().eq('id', id)
    if (err) { setError(err.message); return false }
    return true
  }, [id])

  return {
    producto, setProducto, categorias, subcategorias,
    receta, loading, guardando, error,
    guardar, eliminar, cargarSubcategorias,
  }
}
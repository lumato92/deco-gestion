'use client'

// src/app/dashboard/pedidos/[id]/editar/page.tsx

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCompras, type LineaCompra } from '@/hooks/use-compras'
import { SelectorProveedor, BuscadorArticulo, type ProveedorBasico } from '@/components/compras/modales-inline'
import { formatMonto } from '@/lib/utils'

const CATEGORIAS_OTRO = [
  { val: 'herramienta',      label: 'Herramienta' },
  { val: 'packaging',        label: 'Packaging' },
  { val: 'material_trabajo', label: 'Material de trabajo' },
  { val: 'servicio',         label: 'Servicio' },
  { val: 'otro',             label: 'Otro' },
]

export default function EditarPedidoPage() {
  const router = useRouter()
  const params = useParams()
  const id = Number(params.id)
  const { guardarCompra } = useCompras('pedido')

  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [fecha, setFecha] = useState('')
  const [proveedor, setProveedor] = useState<ProveedorBasico | null>(null)
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState<LineaCompra[]>([])
  const [panelAgregar, setPanelAgregar] = useState(false)
  const [tipoNueva, setTipoNueva] = useState<'insumo' | 'producto' | 'otro'>('insumo')
  const [nombreLibre, setNombreLibre] = useState('')
  const [estadoPago, setEstadoPago] = useState<'pagado' | 'pendiente' | 'parcial'>('pendiente')

  useEffect(() => {
    const supabase = createClient()
    const cargar = async () => {
      const [compraRes, lineasRes] = await Promise.all([
        supabase.from('compras_con_total').select('*').eq('id', id).single(),
        supabase.from('lineas_compra').select('*').eq('compra_id', id),
      ])
      if (compraRes.data) {
        const c = compraRes.data
        setFecha(c.fecha)
        setNotas(c.notas ?? '')
        setEstadoPago(c.estado_pago)
        if (c.proveedor_id && c.proveedor_nombre) {
          setProveedor({ id: c.proveedor_id, nombre: c.proveedor_nombre })
        }
      }
      if (lineasRes.data) {
        setLineas(lineasRes.data.map((l: any) => ({
          id: l.id,
          tipo_destino: l.tipo_destino,
          item_id: l.item_id,
          nombre: l.nombre,
          categoria_otro: l.categoria_otro,
          cantidad_pedida: l.cantidad_pedida,
          cantidad_recibida: l.cantidad_recibida,
          precio_unitario: l.precio_unitario,
        })))
      }
      setLoading(false)
    }
    cargar()
  }, [id])

  const total = lineas.reduce((s, l) => s + l.cantidad_pedida * l.precio_unitario, 0)

  const agregarLinea = (item: any, tipo: 'insumo' | 'producto' | 'otro', nombre: string) => {
    setLineas(prev => [...prev, {
      tipo_destino: tipo,
      item_id: item?.id ?? null,
      nombre,
      cantidad_pedida: 1,
      cantidad_recibida: 0,
      precio_unitario: item?.costo ?? 0,
    }])
    setPanelAgregar(false)
    setNombreLibre('')
  }

  const handleGuardar = async () => {
    if (!proveedor) { setError('El proveedor es obligatorio'); return }
    if (lineas.length === 0) { setError('Agregá al menos un artículo'); return }
    setGuardando(true)
    setError('')

    const ok = await guardarCompra({
      proveedor_id: proveedor.id,
      fecha,
      tipo: 'pedido',
      estado: 'pendiente',
      estado_pago: estadoPago,
      notas: notas || null,
    } as any, lineas, [], id)

    if (ok) router.push('/dashboard/pedidos')
    else { setError('Error al guardar el pedido'); setGuardando(false) }
  }

  if (loading) return (
    <div className="p-5 flex flex-col gap-4">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Pedidos › Editar</p>
          <h1 className="text-base font-medium text-gray-900">Editar pedido</h1>
        </div>
        <button onClick={() => router.back()}
          className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-500 hover:bg-gray-50">
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-4 items-start">

        {/* IZQUIERDA — artículos */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-medium text-gray-900">Artículos del pedido</div>
            {!panelAgregar && (
              <button onClick={() => setPanelAgregar(true)} className="text-[11px] text-teal-600 font-medium hover:underline">+ Agregar artículo</button>
            )}
          </div>

          {panelAgregar && (
            <div className="mb-3 border border-dashed border-purple-300 bg-purple-50 rounded-lg p-3 flex flex-col gap-2">
              <div className="flex gap-1.5">
                {(['insumo', 'producto', 'otro'] as const).map(t => (
                  <button key={t} onClick={() => setTipoNueva(t)}
                    className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${tipoNueva === t ? 'border-purple-500 bg-white text-purple-800' : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'}`}>
                    {t === 'insumo' ? 'Insumo' : t === 'producto' ? 'Producto' : 'Otro'}
                  </button>
                ))}
              </div>
              {tipoNueva === 'otro' ? (
                <div className="flex gap-2">
                  <input type="text" placeholder="Nombre..." value={nombreLibre} onChange={e => setNombreLibre(e.target.value)}
                    className="flex-1 text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
                  <button onClick={() => { if (nombreLibre.trim()) agregarLinea(null, 'otro', nombreLibre.trim()) }}
                    disabled={!nombreLibre.trim()}
                    className="px-3 py-1.5 text-[11px] font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                    Agregar
                  </button>
                </div>
              ) : (
                <BuscadorArticulo tipoDestino={tipoNueva} onSeleccionar={item => agregarLinea(item, tipoNueva, item.nombre)} />
              )}
              <button onClick={() => setPanelAgregar(false)} className="text-[11px] text-gray-400 hover:text-gray-600 self-start">Cancelar</button>
            </div>
          )}

          {lineas.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">Sin artículos</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-3 py-2 text-[11px] font-medium text-gray-400">Artículo</th>
                  <th className="text-center px-3 py-2 text-[11px] font-medium text-gray-400">Cantidad</th>
                  <th className="text-right px-3 py-2 text-[11px] font-medium text-gray-400">Precio unit.</th>
                  <th className="text-right px-3 py-2 text-[11px] font-medium text-gray-400">Subtotal</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${l.tipo_destino === 'insumo' ? 'bg-teal-50 text-teal-700' : l.tipo_destino === 'producto' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                          {l.tipo_destino === 'insumo' ? 'Insumo' : l.tipo_destino === 'producto' ? 'Producto' : 'Otro'}
                        </span>
                        <span className="text-[12px] font-medium text-gray-900">{l.nombre}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="number" min={1} step={0.01} value={l.cantidad_pedida}
                        onChange={e => setLineas(prev => prev.map((x, j) => j === i ? { ...x, cantidad_pedida: Number(e.target.value) } : x))}
                        className="w-20 text-center text-[12px] text-gray-900 bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:border-teal-400" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" min={0} value={l.precio_unitario}
                        onChange={e => setLineas(prev => prev.map((x, j) => j === i ? { ...x, precio_unitario: Number(e.target.value) } : x))}
                        className="w-28 text-right text-[12px] text-gray-900 bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:border-teal-400" />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {formatMonto(l.cantidad_pedida * l.precio_unitario)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => setLineas(prev => prev.filter((_, j) => j !== i))}
                        className="text-gray-300 hover:text-red-400 text-base leading-none">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* DERECHA */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
            <div className="text-[13px] font-medium text-gray-900">Datos del pedido</div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-teal-400" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Proveedor *</label>
              <SelectorProveedor value={proveedor} onChange={setProveedor} obligatorio />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Notas</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400 resize-none" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex justify-between text-[13px]">
              <span className="text-gray-600">Total del pedido</span>
              <span className="text-xl font-medium text-gray-900">{formatMonto(total)}</span>
            </div>
            {error && <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            <button onClick={handleGuardar} disabled={guardando || lineas.length === 0 || !proveedor}
              className="w-full py-2.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
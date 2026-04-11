'use client'

// src/app/dashboard/pedidos/nuevo/page.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCompras, type LineaCompra, type PagoCompra } from '@/hooks/use-compras'
import { SelectorProveedor, BuscadorArticulo, type ProveedorBasico } from '@/components/compras/modales-inline'
import { formatMonto } from '@/lib/utils'

const CATEGORIAS_OTRO = [
  { val: 'herramienta',      label: 'Herramienta' },
  { val: 'packaging',        label: 'Packaging' },
  { val: 'material_trabajo', label: 'Material de trabajo' },
  { val: 'servicio',         label: 'Servicio' },
  { val: 'otro',             label: 'Otro' },
]

export default function NuevoPedidoPage() {
  const router = useRouter()
  const { guardarCompra } = useCompras('pedido')

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [proveedor, setProveedor] = useState<ProveedorBasico | null>(null)
  const [notas, setNotas] = useState('')

  const [lineas, setLineas] = useState<LineaCompra[]>([])
  const [panelAgregar, setPanelAgregar] = useState(false)
  const [tipoNueva, setTipoNueva] = useState<'insumo' | 'producto' | 'otro'>('insumo')
  const [nombreLibre, setNombreLibre] = useState('')

  const [estadoPago, setEstadoPago] = useState<'pagado' | 'pendiente' | 'parcial'>('pendiente')
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'credito'>('efectivo')
  const [montoAnticipo, setMontoAnticipo] = useState(0)
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const total = lineas.reduce((s, l) => s + l.cantidad_pedida * l.precio_unitario, 0)

  const agregarLinea = (item: any, tipo: 'insumo' | 'producto' | 'otro', nombre: string) => {
    setLineas(prev => [...prev, {
      tipo_destino: tipo,
      item_id: item?.id ?? null,
      nombre,
      cantidad_pedida: 1,
      cantidad_recibida: 0, // pedido previo → todavía no recibido
      precio_unitario: item?.costo ?? 0,
    }])
    setPanelAgregar(false)
    setNombreLibre('')
  }

  const handleGuardar = async () => {
    if (!proveedor) { setError('El proveedor es obligatorio para un pedido'); return }
    if (lineas.length === 0) { setError('Agregá al menos un artículo'); return }
    setGuardando(true)
    setError('')

    const pagos: PagoCompra[] = estadoPago === 'parcial' && montoAnticipo > 0 ? [{
      fecha: fechaPago,
      monto: montoAnticipo,
      metodo_pago: metodoPago,
      notas: 'Anticipo',
    }] : estadoPago === 'pagado' ? [{
      fecha: fechaPago,
      monto: total,
      metodo_pago: metodoPago,
    }] : []

    const id = await guardarCompra({
      proveedor_id: proveedor.id,
      fecha,
      tipo: 'pedido',
      estado: 'pendiente',
      metodo_pago: estadoPago !== 'pendiente' ? metodoPago : null,
      estado_pago: estadoPago,
      notas: notas || null,
    } as any, lineas, pagos)

    if (id) router.push('/dashboard/pedidos')
    else { setError('Error al guardar el pedido'); setGuardando(false) }
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Pedidos › Nuevo pedido</p>
          <h1 className="text-base font-medium text-gray-900">Nueva orden de compra</h1>
        </div>
        <button onClick={() => router.back()}
          className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-500 hover:bg-gray-50">
          Cancelar
        </button>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5 text-[12px] text-purple-800">
        Pedido previo al proveedor — se genera la OC, el stock se actualiza al confirmar la recepción.
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-4 items-start">

        {/* IZQUIERDA */}
        <div className="flex flex-col gap-4">

          {/* Artículos */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-medium text-gray-900">Artículos a pedir</div>
              {!panelAgregar && (
                <button onClick={() => setPanelAgregar(true)}
                  className="text-[11px] text-teal-600 font-medium hover:underline">+ Agregar artículo</button>
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
                    <input type="text" placeholder="Nombre del artículo..."
                      value={nombreLibre} onChange={e => setNombreLibre(e.target.value)}
                      className="flex-1 text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400" />
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
              <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                Agregá los artículos que vas a pedir
              </div>
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
                        {l.tipo_destino === 'otro' && (
                          <select value={l.categoria_otro ?? ''} onChange={e => setLineas(prev => prev.map((x, j) => j === i ? { ...x, categoria_otro: e.target.value as any } : x))}
                            className="mt-1 text-[11px] bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-gray-600 focus:outline-none">
                            <option value="">Categoría...</option>
                            {CATEGORIAS_OTRO.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
                          </select>
                        )}
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
        </div>

        {/* DERECHA */}
        <div className="flex flex-col gap-4">

          {/* Proveedor y datos */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
            <div className="text-[13px] font-medium text-gray-900">Datos del pedido</div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-teal-400" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">
                Proveedor <span className="text-amber-600">*</span>
              </label>
              <SelectorProveedor value={proveedor} onChange={setProveedor} obligatorio />
              {!proveedor && (
                <p className="text-[11px] text-amber-600">Obligatorio para generar la OC</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Notas / Observaciones</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
                placeholder="Condiciones, plazos de entrega, aclaraciones..."
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400 resize-none" />
            </div>
          </div>

          {/* Pago */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
            <div className="text-[13px] font-medium text-gray-900">Condición de pago</div>
            <div className="flex flex-col gap-1.5">
              {([
                { val: 'pendiente', label: 'Pago pendiente',  hint: 'Se paga al recibir la mercadería' },
                { val: 'parcial',   label: 'Anticipo parcial', hint: 'El proveedor requiere un adelanto' },
                { val: 'pagado',    label: 'Prepago total',    hint: 'Se paga antes de recibirlo' },
              ] as const).map(op => (
                <label key={op.val} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${estadoPago === op.val ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="ep" checked={estadoPago === op.val} onChange={() => setEstadoPago(op.val)} className="flex-shrink-0" />
                  <div>
                    <div className="text-[12px] font-medium text-gray-900">{op.label}</div>
                    <div className="text-[11px] text-gray-400">{op.hint}</div>
                  </div>
                </label>
              ))}
            </div>

            {estadoPago !== 'pendiente' && (
              <>
                <div className="flex gap-2">
                  {(['efectivo', 'transferencia', 'credito'] as const).map(m => (
                    <button key={m} onClick={() => setMetodoPago(m)}
                      className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${metodoPago === m ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {m === 'efectivo' ? 'Efectivo' : m === 'transferencia' ? 'Transf.' : 'Crédito'}
                    </button>
                  ))}
                </div>
                {estadoPago === 'parcial' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-gray-500 uppercase tracking-wide">Monto del anticipo</label>
                    <input type="number" min={0} max={total} value={montoAnticipo || ''}
                      onChange={e => setMontoAnticipo(Number(e.target.value))}
                      className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-teal-400" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-gray-500 uppercase tracking-wide">Fecha de pago</label>
                  <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}
                    className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-teal-400" />
                </div>
              </>
            )}
          </div>

          {/* Total y confirmar */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Resumen del pedido</div>
            <div className="flex justify-between text-[13px]">
              <span className="text-gray-600">Total a abonar</span>
              <span className="text-xl font-medium text-gray-900">{formatMonto(total)}</span>
            </div>
            {estadoPago === 'parcial' && montoAnticipo > 0 && (
              <>
                <div className="flex justify-between text-[12px]">
                  <span className="text-gray-500">Anticipo</span>
                  <span className="font-medium text-amber-700">{formatMonto(montoAnticipo)}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-gray-500">Saldo al recibir</span>
                  <span className="font-medium text-gray-700">{formatMonto(total - montoAnticipo)}</span>
                </div>
              </>
            )}
            {estadoPago === 'pendiente' && total > 0 && (
              <div className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                El pago se registrará al recibir la mercadería
              </div>
            )}

            {error && <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

            <button onClick={handleGuardar} disabled={guardando || lineas.length === 0 || !proveedor}
              className="w-full py-2.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
              {guardando ? 'Generando OC...' : `Generar orden de compra · ${formatMonto(total)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
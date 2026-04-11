'use client'

// src/app/dashboard/compras/nueva/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCompras, type LineaCompra, type PagoCompra } from '@/hooks/use-compras'
import { formatMonto } from '@/lib/utils'

interface Proveedor { id: number; nombre: string; telefono?: string }
interface InsumoOProd { id: number; nombre: string; unidad?: string; stock: number; costo: number }

function normalizar(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ── Buscador de artículo (insumo o producto) ──────────────────

function BuscadorArticulo({ tipo, onSeleccionar }: {
  tipo: 'insumo' | 'producto'
  onSeleccionar: (item: InsumoOProd) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [todos, setTodos] = useState<InsumoOProd[]>([])
  const [resultados, setResultados] = useState<InsumoOProd[]>([])

  useEffect(() => {
    const supabase = createClient()
    const tabla = tipo === 'insumo' ? 'insumos' : 'productos_con_margen'
    supabase.from(tabla).select('id, nombre, stock, costo').order('nombre').limit(200)
      .then(({ data }) => setTodos(data ?? []))
  }, [tipo])

  useEffect(() => {
    if (busqueda.length < 2) { setResultados([]); return }
    const q = normalizar(busqueda)
    setResultados(todos.filter(p => normalizar(p.nombre).includes(q)).slice(0, 6))
  }, [busqueda, todos])

  return (
    <div className="relative">
      <input type="text" placeholder={`Buscar ${tipo}...`}
        value={busqueda} onChange={e => setBusqueda(e.target.value)}
        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
      {resultados.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg z-10 shadow-sm overflow-hidden">
          {resultados.map(r => (
            <button key={r.id}
              onClick={() => { onSeleccionar(r); setBusqueda('') }}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
              <div className="text-[12px] font-medium text-gray-900">{r.nombre}</div>
              <div className="text-[11px] text-gray-400">Stock: {r.stock}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Fila de línea de compra ───────────────────────────────────

function FilaLinea({ linea, index, onActualizar, onEliminar, esDirecta }: {
  linea: LineaCompra
  index: number
  onActualizar: (i: number, campo: Partial<LineaCompra>) => void
  onEliminar: (i: number) => void
  esDirecta: boolean
}) {
  const CATEGORIAS_OTRO = [
    { val: 'herramienta',      label: 'Herramienta' },
    { val: 'packaging',        label: 'Packaging' },
    { val: 'material_trabajo', label: 'Material de trabajo' },
    { val: 'servicio',         label: 'Servicio' },
    { val: 'otro',             label: 'Otro' },
  ]

  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            linea.tipo_destino === 'insumo' ? 'bg-teal-50 text-teal-700' :
            linea.tipo_destino === 'producto' ? 'bg-purple-50 text-purple-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {linea.tipo_destino === 'insumo' ? 'Insumo' : linea.tipo_destino === 'producto' ? 'Producto' : 'Otro'}
          </span>
          <span className="text-[12px] font-medium text-gray-900">{linea.nombre}</span>
        </div>
        {linea.tipo_destino === 'otro' && (
          <select
            value={linea.categoria_otro ?? ''}
            onChange={e => onActualizar(index, { categoria_otro: e.target.value as any })}
            className="mt-1 text-[11px] bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-gray-600 focus:outline-none">
            <option value="">Categoría...</option>
            {CATEGORIAS_OTRO.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
          </select>
        )}
      </td>
      <td className="px-3 py-2">
        <input type="number" min={0} step={0.01} value={linea.cantidad_pedida}
          onChange={e => {
            const v = Number(e.target.value)
            onActualizar(index, {
              cantidad_pedida: v,
              cantidad_recibida: esDirecta ? v : linea.cantidad_recibida,
            })
          }}
          className="w-20 text-center text-[12px] text-gray-900 bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:border-teal-400" />
      </td>
      {!esDirecta && (
        <td className="px-3 py-2">
          <input type="number" min={0} max={linea.cantidad_pedida} step={0.01}
            value={linea.cantidad_recibida}
            onChange={e => onActualizar(index, { cantidad_recibida: Number(e.target.value) })}
            className="w-20 text-center text-[12px] text-gray-900 bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:border-teal-400" />
        </td>
      )}
      <td className="px-3 py-2">
        <input type="number" min={0} value={linea.precio_unitario}
          onChange={e => onActualizar(index, { precio_unitario: Number(e.target.value) })}
          className="w-28 text-right text-[12px] text-gray-900 bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:border-teal-400" />
      </td>
      <td className="px-3 py-2 text-right text-[12px] font-medium text-gray-900">
        {formatMonto((esDirecta ? linea.cantidad_pedida : linea.cantidad_recibida) * linea.precio_unitario)}
      </td>
      <td className="px-3 py-2 text-center">
        <button onClick={() => onEliminar(index)}
          className="text-gray-300 hover:text-red-400 text-base leading-none">×</button>
      </td>
    </tr>
  )
}

// ── Página ────────────────────────────────────────────────────

export default function NuevaCompraPage() {
  const router = useRouter()
  const { guardarCompra, loading: guardando } = useCompras()

  // Encabezado
  const [tipo, setTipo] = useState<'directa' | 'pedido'>('directa')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [busquedaProv, setBusquedaProv] = useState('')
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [resultadosProv, setResultadosProv] = useState<Proveedor[]>([])
  const [numeroRemito, setNumeroRemito] = useState('')
  const [numeroFactura, setNumeroFactura] = useState('')
  const [notas, setNotas] = useState('')

  // Líneas
  const [lineas, setLineas] = useState<LineaCompra[]>([])
  const [mostrarAgregarLinea, setMostrarAgregarLinea] = useState(false)
  const [tipoNuevaLinea, setTipoNuevaLinea] = useState<'insumo' | 'producto' | 'otro'>('insumo')
  const [nombreLibre, setNombreLibre] = useState('')

  // Pago
  const [estadoPago, setEstadoPago] = useState<'pagado' | 'pendiente' | 'parcial'>('pagado')
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'credito'>('efectivo')
  const [montoPagado, setMontoPagado] = useState(0)
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])

  const [error, setError] = useState('')

  // Cargar proveedores
  useEffect(() => {
    createClient().from('proveedores').select('id, nombre, telefono')
      .eq('activo', true).order('nombre')
      .then(({ data }) => setProveedores(data ?? []))
  }, [])

  useEffect(() => {
    if (busquedaProv.length < 1) { setResultadosProv([]); return }
    const q = normalizar(busquedaProv)
    setResultadosProv(proveedores.filter(p => normalizar(p.nombre).includes(q)).slice(0, 6))
  }, [busquedaProv, proveedores])

  const totalLineas = lineas.reduce((s, l) =>
    s + ((tipo === 'directa' ? l.cantidad_pedida : l.cantidad_recibida) * l.precio_unitario), 0)

  // Sync monto pagado cuando cambia total o estado
  useEffect(() => {
    if (estadoPago === 'pagado') setMontoPagado(totalLineas)
    else if (estadoPago === 'pendiente') setMontoPagado(0)
  }, [estadoPago, totalLineas])

  const agregarLinea = (item: InsumoOProd | null, tipo_destino: 'insumo' | 'producto' | 'otro', nombre: string) => {
    setLineas(prev => [...prev, {
      tipo_destino,
      item_id: item?.id ?? null,
      nombre,
      cantidad_pedida: 1,
      cantidad_recibida: tipo === 'directa' ? 1 : 0,
      precio_unitario: item?.costo ?? 0,
    }])
    setMostrarAgregarLinea(false)
    setNombreLibre('')
  }

  const actualizarLinea = (i: number, campo: Partial<LineaCompra>) => {
    setLineas(prev => prev.map((l, j) => j === i ? { ...l, ...campo } : l))
  }

  const eliminarLinea = (i: number) => {
    setLineas(prev => prev.filter((_, j) => j !== i))
  }

  const handleGuardar = async () => {
    if (lineas.length === 0) { setError('Agregá al menos un artículo'); return }
    setError('')

    const esDirecta = tipo === 'directa'
    const estadoCompra = esDirecta ? 'recibida' : (
      lineas.some(l => l.cantidad_recibida > 0)
        ? (lineas.some(l => l.cantidad_recibida < l.cantidad_pedida) ? 'recibida_parcial' : 'recibida')
        : 'pendiente'
    )

    const pagos: PagoCompra[] = estadoPago !== 'pendiente' ? [{
      fecha: fechaPago,
      monto: estadoPago === 'pagado' ? totalLineas : montoPagado,
      metodo_pago: metodoPago,
    }] : []

    const compraId = await guardarCompra(
      {
        proveedor_id: proveedor?.id ?? null,
        fecha,
        tipo,
        estado: estadoCompra,
        metodo_pago: metodoPago,
        estado_pago: estadoPago,
        numero_remito: numeroRemito || null,
        numero_factura: numeroFactura || null,
        notas: notas || null,
      } as any,
      lineas,
      pagos
    )

    if (compraId) router.push('/dashboard/compras')
    else setError('Error al guardar la compra')
  }

  const esDirecta = tipo === 'directa'

  return (
    <div className="p-5 flex flex-col gap-4">

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Compras › Nueva compra</p>
          <h1 className="text-base font-medium text-gray-900">Nueva compra</h1>
        </div>
        <button onClick={() => router.back()}
          className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-500 hover:bg-gray-50">
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-4 items-start">

        {/* COLUMNA IZQUIERDA */}
        <div className="flex flex-col gap-4">

          {/* Tipo de compra */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-gray-900 mb-3">Tipo de compra</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTipo('directa')}
                className={`p-3 rounded-lg border text-left transition-colors ${tipo === 'directa' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="text-[13px] font-medium text-gray-900">Compra directa</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Fui al proveedor, compré y volví con remito/factura</div>
              </button>
              <button onClick={() => setTipo('pedido')}
                className={`p-3 rounded-lg border text-left transition-colors ${tipo === 'pedido' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="text-[13px] font-medium text-gray-900">Pedido previo</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Hice el pedido, está pendiente de llegar</div>
              </button>
            </div>
          </div>

          {/* Artículos */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-medium text-gray-900">Artículos</div>
              {!mostrarAgregarLinea && (
                <button onClick={() => setMostrarAgregarLinea(true)}
                  className="text-[11px] text-teal-600 font-medium hover:underline">+ Agregar artículo</button>
              )}
            </div>

            {/* Panel agregar artículo */}
            {mostrarAgregarLinea && (
              <div className="mb-3 border border-dashed border-teal-300 bg-teal-50 rounded-lg p-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  {(['insumo', 'producto', 'otro'] as const).map(t => (
                    <button key={t} onClick={() => setTipoNuevaLinea(t)}
                      className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
                        tipoNuevaLinea === t ? 'border-teal-500 bg-white text-teal-800' : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
                      }`}>
                      {t === 'insumo' ? 'Insumo' : t === 'producto' ? 'Producto' : 'Otro (herramienta, packaging...)'}
                    </button>
                  ))}
                </div>

                {tipoNuevaLinea === 'otro' ? (
                  <div className="flex gap-2">
                    <input type="text" placeholder="Nombre del artículo..."
                      value={nombreLibre} onChange={e => setNombreLibre(e.target.value)}
                      className="flex-1 text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
                    <button
                      onClick={() => { if (nombreLibre.trim()) agregarLinea(null, 'otro', nombreLibre.trim()) }}
                      disabled={!nombreLibre.trim()}
                      className="px-3 py-1.5 text-[11px] font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                      Agregar
                    </button>
                  </div>
                ) : (
                  <BuscadorArticulo
                    tipo={tipoNuevaLinea}
                    onSeleccionar={item => agregarLinea(item, tipoNuevaLinea, item.nombre)}
                  />
                )}

                <button onClick={() => setMostrarAgregarLinea(false)}
                  className="text-[11px] text-gray-400 hover:text-gray-600 self-start">Cancelar</button>
              </div>
            )}

            {lineas.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                Agregá artículos para continuar
              </div>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-3 py-2 text-[11px] font-medium text-gray-400">Artículo</th>
                    <th className="text-center px-3 py-2 text-[11px] font-medium text-gray-400">
                      {esDirecta ? 'Cantidad' : 'Pedido'}
                    </th>
                    {!esDirecta && (
                      <th className="text-center px-3 py-2 text-[11px] font-medium text-gray-400">Recibido</th>
                    )}
                    <th className="text-right px-3 py-2 text-[11px] font-medium text-gray-400">Precio unit.</th>
                    <th className="text-right px-3 py-2 text-[11px] font-medium text-gray-400">Subtotal</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => (
                    <FilaLinea key={i} linea={l} index={i}
                      onActualizar={actualizarLinea}
                      onEliminar={eliminarLinea}
                      esDirecta={esDirecta}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="flex flex-col gap-4">

          {/* Proveedor y datos */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
            <div className="text-[13px] font-medium text-gray-900">Datos de la compra</div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-teal-400" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Proveedor (opcional)</label>
              {proveedor ? (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <span className="flex-1 text-[13px] font-medium text-gray-900">{proveedor.nombre}</span>
                  <button onClick={() => setProveedor(null)}
                    className="text-[11px] text-gray-400 hover:text-gray-600">Cambiar</button>
                </div>
              ) : (
                <div className="relative">
                  <input type="text" placeholder="Buscar proveedor..."
                    value={busquedaProv} onChange={e => setBusquedaProv(e.target.value)}
                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
                  {resultadosProv.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg z-10 shadow-sm overflow-hidden">
                      {resultadosProv.map(p => (
                        <button key={p.id}
                          onClick={() => { setProveedor(p); setBusquedaProv('') }}
                          className="w-full text-left px-3 py-2 text-[12px] font-medium text-gray-900 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                          {p.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">N° Remito</label>
                <input type="text" value={numeroRemito} onChange={e => setNumeroRemito(e.target.value)}
                  placeholder="Opcional"
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wide">N° Factura</label>
                <input type="text" value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)}
                  placeholder="Opcional"
                  className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Notas</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                placeholder="Observaciones, condiciones, etc."
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400 resize-none" />
            </div>
          </div>

          {/* Pago */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
            <div className="text-[13px] font-medium text-gray-900">Pago</div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">Estado del pago</label>
              <div className="flex flex-col gap-1.5">
                {([
                  { val: 'pagado',   label: 'Ya pagué',              hint: 'Abonado en el momento' },
                  { val: 'parcial',  label: 'Pagué en parte',        hint: 'Pago parcial, queda saldo' },
                  { val: 'pendiente', label: 'Pago pendiente',       hint: 'A crédito o todavía no pago' },
                ] as const).map(op => (
                  <label key={op.val}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      estadoPago === op.val ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                    <input type="radio" name="estadoPago" checked={estadoPago === op.val}
                      onChange={() => setEstadoPago(op.val)} className="flex-shrink-0" />
                    <div>
                      <div className="text-[12px] font-medium text-gray-900">{op.label}</div>
                      <div className="text-[11px] text-gray-400">{op.hint}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {estadoPago !== 'pendiente' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-gray-500 uppercase tracking-wide">Método de pago</label>
                  <div className="flex gap-2">
                    {(['efectivo', 'transferencia', 'credito'] as const).map(m => (
                      <button key={m} onClick={() => setMetodoPago(m)}
                        className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
                          metodoPago === m ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}>
                        {m === 'efectivo' ? 'Efectivo' : m === 'transferencia' ? 'Transferencia' : 'Crédito'}
                      </button>
                    ))}
                  </div>
                </div>

                {estadoPago === 'parcial' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-gray-500 uppercase tracking-wide">Monto pagado</label>
                    <input type="number" min={0} value={montoPagado || ''}
                      onChange={e => setMontoPagado(Number(e.target.value))}
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
            <div className="flex justify-between text-[13px]">
              <span className="text-gray-600">Total compra</span>
              <span className="font-medium text-gray-900">{formatMonto(totalLineas)}</span>
            </div>
            {estadoPago === 'parcial' && montoPagado > 0 && (
              <div className="flex justify-between text-[12px]">
                <span className="text-gray-500">Saldo pendiente</span>
                <span className="font-medium text-amber-700">{formatMonto(totalLineas - montoPagado)}</span>
              </div>
            )}

            {error && (
              <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}

            <button onClick={handleGuardar}
              disabled={lineas.length === 0}
              className="w-full py-2.5 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors">
              {tipo === 'directa' ? `Registrar compra · ${formatMonto(totalLineas)}` : `Crear pedido · ${formatMonto(totalLineas)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
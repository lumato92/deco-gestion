'use client'

// src/app/dashboard/integraciones/mercadolibre/page.tsx
//
// T7 — Pantalla de administración de Mercado Libre.
// Estado de la conexión, importación de ventas históricas (backfill) y
// registro de las últimas importaciones. Reemplaza el manejo por consola.

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatMonto } from '@/lib/utils'

interface EstadoML {
  conectado: boolean
  sync_habilitado: boolean
  cuenta: {
    seller_id: string
    nickname: string | null
    estado: 'activo' | 'degradado'
    expires_at: string
    ultimo_error: string | null
    actualizado: string
  } | null
  sin_conciliar: number
  errores: number
  importaciones: { ml_order_id: string; resultado: string; detalle: string | null; created_at: string }[]
}

const RESULTADO_CFG: Record<string, { label: string; cls: string }> = {
  importada:     { label: 'Importada',     cls: 'bg-teal-50 text-teal-700' },
  duplicada:     { label: 'Duplicada',     cls: 'bg-gray-100 text-gray-500' },
  sin_conciliar: { label: 'Sin conciliar', cls: 'bg-amber-50 text-amber-700' },
  gasto_flete:   { label: 'Flete',         cls: 'bg-blue-50 text-blue-700' },
  ignorada:      { label: 'Ignorada',      cls: 'bg-gray-100 text-gray-400' },
  error:         { label: 'Error',         cls: 'bg-red-50 text-red-600' },
}

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function PageInner() {
  const params = useSearchParams()
  const [estado, setEstado] = useState<EstadoML | null>(null)
  const [loading, setLoading] = useState(true)
  // Cada tarjeta se recarga cuando la otra cambia algo que la afecta.
  const [versionPublicaciones, setVersionPublicaciones] = useState(0)
  const [versionConciliacion, setVersionConciliacion] = useState(0)

  // Resultado del retorno del OAuth (?estado=conectado|error)
  const oauthEstado = params.get('estado')
  const oauthCuenta = params.get('cuenta')
  const oauthMotivo = params.get('motivo')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/ml/estado', { cache: 'no-store' })
      setEstado(await r.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-medium text-gray-900">Mercado Libre</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          Las ventas de tus publicaciones entran solas como pedidos, con comisión, envío y descuento de stock.
        </p>
      </div>

      {/* Aviso del retorno del OAuth */}
      {oauthEstado === 'conectado' && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-[13px] text-teal-800">
          ✓ Cuenta <span className="font-medium">{oauthCuenta}</span> conectada correctamente.
        </div>
      )}
      {oauthEstado === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          No se pudo conectar: {oauthMotivo ?? 'error desconocido'}
        </div>
      )}

      <TarjetaConexion estado={estado} loading={loading} />

      {estado?.conectado && (
        <>
          <TarjetaPublicaciones version={versionPublicaciones} onCambio={() => setVersionConciliacion(v => v + 1)} />
          <TarjetaConciliacion
            version={versionConciliacion}
            onAplicado={() => { cargar(); setVersionPublicaciones(v => v + 1) }}
          />
          <TarjetaBackfill onImportado={cargar} />
          <TarjetaImportaciones estado={estado} />
        </>
      )}
    </div>
  )
}

function TarjetaConexion({ estado, loading }: { estado: EstadoML | null; loading: boolean }) {
  if (loading) {
    return <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
  }

  const cuenta = estado?.cuenta
  const degradado = cuenta?.estado === 'degradado'
  const vence = cuenta ? new Date(cuenta.expires_at) : null

  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-gray-900">Estado de la conexión</span>
            {!estado?.conectado ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Sin conectar</span>
            ) : degradado ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Desconectada</span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">Activa</span>
            )}
            {estado?.conectado && !estado.sync_habilitado && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                Sync en pausa
              </span>
            )}
          </div>

          {cuenta ? (
            <div className="mt-2 space-y-0.5 text-[12px] text-gray-500">
              <div>Cuenta: <span className="text-gray-700 font-medium">{cuenta.nickname ?? cuenta.seller_id}</span></div>
              {!degradado && vence && (
                <div>Token válido hasta las {vence.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} (se renueva solo)</div>
              )}
              {degradado && (
                <div className="text-red-600">
                  {cuenta.ultimo_error ?? 'La renovación del token falló. Reconectá la cuenta.'}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-gray-500">
              Conectá tu cuenta de Mercado Libre para que las ventas entren automáticamente.
            </p>
          )}
        </div>

        {/* El OAuth arranca desde acá; el botón es un link directo. */}
        <a
          href="/api/ml/oauth/iniciar"
          className={`shrink-0 text-[12px] px-3 py-1.5 rounded-lg font-medium ${
            degradado || !estado?.conectado
              ? 'bg-teal-600 text-white hover:bg-teal-700'
              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {!estado?.conectado ? 'Conectar' : degradado ? 'Reconectar' : 'Reconectar'}
        </a>
      </div>

      {estado?.conectado && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] text-gray-400 uppercase tracking-wide">Sin conciliar</div>
            <div className={`text-lg font-medium ${estado.sin_conciliar > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {estado.sin_conciliar}
            </div>
            <div className="text-[11px] text-gray-400">ventas sin producto asociado</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-400 uppercase tracking-wide">Errores</div>
            <div className={`text-lg font-medium ${estado.errores > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {estado.errores}
            </div>
            <div className="text-[11px] text-gray-400">importaciones fallidas</div>
          </div>
        </div>
      )}
    </div>
  )
}

interface ResultadoBackfill {
  ok: boolean
  simulacion?: boolean
  mensaje?: string
  error?: string
  resumen?: Record<string, number>
  totales?: { facturado: number; comision: number; envio: number; impuestos: number; neto: number; gastoFlete: number }
  procesadas?: number
}

function TarjetaBackfill({ onImportado }: { onImportado: () => void }) {
  const primerDiaMes = new Date()
  primerDiaMes.setDate(1)
  const [desde, setDesde] = useState(primerDiaMes.toISOString().slice(0, 10))
  const [corriendo, setCorriendo] = useState(false)
  const [res, setRes] = useState<ResultadoBackfill | null>(null)

  const correr = async (dryRun: boolean) => {
    setCorriendo(true)
    setRes(null)
    try {
      const r = await fetch('/api/ml/backfill', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ desde, dry_run: dryRun }),
      })
      const data = await r.json()
      setRes(data)
      if (!dryRun && data.ok) onImportado()
    } catch (e) {
      setRes({ ok: false, error: e instanceof Error ? e.message : 'Error de red' })
    } finally {
      setCorriendo(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-5">
      <div className="text-[13px] font-medium text-gray-900">Importar ventas anteriores</div>
      <p className="text-[12px] text-gray-500 mt-0.5">
        Trae las órdenes ya cerradas desde una fecha. El webhook solo importa las nuevas.
        Simulá primero para ver qué entra sin escribir nada.
      </p>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <label className="text-[12px] text-gray-500">Desde</label>
        <input
          type="date"
          value={desde}
          onChange={e => setDesde(e.target.value)}
          className="text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400"
        />
        <button
          onClick={() => correr(true)}
          disabled={corriendo}
          className="text-[12px] px-3 py-1.5 rounded-lg font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {corriendo ? 'Procesando…' : 'Simular'}
        </button>
        <button
          onClick={() => correr(false)}
          disabled={corriendo}
          className="text-[12px] px-3 py-1.5 rounded-lg font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
        >
          Importar
        </button>
      </div>

      {res && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {!res.ok ? (
            <div className="text-[12px] text-red-600">Error: {res.error}</div>
          ) : (
            <div className="space-y-2">
              <div className="text-[12px] text-gray-600">
                {res.simulacion
                  ? `Simulación — nada se escribió (${res.procesadas} órdenes revisadas)`
                  : `Importación ejecutada (${res.procesadas} órdenes procesadas)`}
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(res.resumen ?? {})
                  .filter(([, n]) => n > 0)
                  .map(([k, n]) => (
                    <span key={k} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${RESULTADO_CFG[k]?.cls ?? 'bg-gray-100 text-gray-500'}`}>
                      {RESULTADO_CFG[k]?.label ?? k}: {n}
                    </span>
                  ))}
              </div>
              {res.totales && res.simulacion && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 text-[12px]">
                  <Dato label="Facturado" valor={res.totales.facturado} />
                  <Dato label="Comisión" valor={res.totales.comision} rojo />
                  <Dato label="Envío" valor={res.totales.envio} rojo />
                  <Dato label="Neto" valor={res.totales.neto} teal />
                  {res.totales.gastoFlete > 0 && <Dato label="Flete cancelada" valor={res.totales.gastoFlete} rojo />}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Dato({ label, valor, rojo, teal }: { label: string; valor: number; rojo?: boolean; teal?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`font-medium ${rojo ? 'text-red-600' : teal ? 'text-teal-700' : 'text-gray-900'}`}>
        {rojo && valor > 0 ? '— ' : ''}{formatMonto(valor)}
      </div>
    </div>
  )
}

interface Publicacion {
  ml_item_id: string
  titulo: string
  precio: number | null
  stock_ml: number | null
  thumbnail: string | null
  permalink: string | null
  activa: boolean
  producto_id: number | null
  unidades_pendientes: number
}

interface ProductoOpcion {
  id: number
  nombre: string
  stock: number
  es_kit: boolean
}

function TarjetaPublicaciones({ version, onCambio }: { version: number; onCambio: () => void }) {
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([])
  const [productos, setProductos] = useState<ProductoOpcion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState<string | null>(null)
  const [soloSinVincular, setSoloSinVincular] = useState(false)
  const [filtro, setFiltro] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/ml/publicaciones', { cache: 'no-store' })
      const data = await r.json()
      if (!data.ok) throw new Error(data.error)
      setPublicaciones(data.publicaciones)
      setProductos(data.productos)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar publicaciones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar, version])

  const vincular = async (pub: Publicacion, productoId: number | null) => {
    setGuardando(pub.ml_item_id)
    setError('')
    try {
      const r = await fetch('/api/ml/publicaciones', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ml_item_id: pub.ml_item_id, producto_id: productoId, titulo: pub.titulo }),
      })
      const data = await r.json()
      if (!data.ok) throw new Error(data.error)
      setPublicaciones(ps => ps.map(p => p.ml_item_id === pub.ml_item_id ? { ...p, producto_id: productoId } : p))
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el vínculo')
    } finally {
      setGuardando(null)
    }
  }

  const productoDe = new Map(productos.map(p => [p.id, p]))
  const texto = filtro.trim().toLowerCase()
  const visibles = publicaciones.filter(p =>
    (!soloSinVincular || p.producto_id == null) &&
    (!texto || p.titulo.toLowerCase().includes(texto) || p.ml_item_id.toLowerCase().includes(texto))
  )
  const sinVincular = publicaciones.filter(p => p.activa && p.producto_id == null).length

  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[13px] font-medium text-gray-900">Publicaciones y productos</div>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Vinculá cada publicación con su producto para que las ventas de ML descuenten stock.
            Varias publicaciones pueden apuntar al mismo producto.
          </p>
        </div>
        {!loading && sinVincular > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium shrink-0">
            {sinVincular} sin vincular
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <input
          type="search"
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          placeholder="Buscar publicación…"
          className="text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-teal-400 flex-1 min-w-[160px]"
        />
        <label className="flex items-center gap-1.5 text-[12px] text-gray-500">
          <input type="checkbox" checked={soloSinVincular} onChange={e => setSoloSinVincular(e.target.checked)} />
          Solo sin vincular
        </label>
      </div>

      {error && <div className="mt-3 text-[12px] text-red-600">Error: {error}</div>}

      <div className="mt-3 space-y-1">
        {loading ? (
          <div className="h-24 rounded-lg bg-gray-100 animate-pulse" />
        ) : visibles.length === 0 ? (
          <div className="text-[12px] text-gray-400 py-3">No hay publicaciones para mostrar.</div>
        ) : visibles.map(pub => {
          const producto = pub.producto_id != null ? productoDe.get(pub.producto_id) : undefined
          return (
            <div key={pub.ml_item_id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 flex-wrap sm:flex-nowrap">
              {pub.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pub.thumbnail} alt="" className="w-10 h-10 rounded-md object-cover shrink-0 bg-gray-100" />
              ) : (
                <div className="w-10 h-10 rounded-md bg-gray-100 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-gray-800 truncate">
                  {pub.permalink ? (
                    <a href={pub.permalink} target="_blank" rel="noreferrer" className="hover:underline">{pub.titulo}</a>
                  ) : pub.titulo}
                </div>
                <div className="text-[11px] text-gray-400 flex gap-2 flex-wrap">
                  <span>{pub.ml_item_id}</span>
                  {pub.precio != null && <span>{formatMonto(pub.precio)}</span>}
                  {pub.stock_ml != null && <span>Stock ML: {pub.stock_ml}</span>}
                  {!pub.activa && <span className="text-gray-500">No activa</span>}
                  {producto && <span className={producto.stock < 0 ? 'text-red-600' : 'text-teal-700'}>Stock interno: {producto.stock}</span>}
                  {pub.unidades_pendientes > 0 && (
                    <span className="text-amber-700">{pub.unidades_pendientes} u. vendidas sin descontar</span>
                  )}
                </div>
              </div>

              <select
                value={pub.producto_id ?? ''}
                disabled={guardando === pub.ml_item_id}
                onChange={e => vincular(pub, e.target.value ? Number(e.target.value) : null)}
                className={`text-[12px] border rounded-lg px-2 py-1.5 w-full sm:w-56 focus:outline-none focus:border-teal-400 disabled:opacity-50 ${
                  pub.producto_id == null ? 'border-amber-300 text-gray-500' : 'border-gray-200 text-gray-700'
                }`}
              >
                <option value="">Sin vincular</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}{p.es_kit ? ' (kit)' : ''} · stock {p.stock}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ImpactoProducto {
  productoId: number
  nombre: string
  esKit: boolean
  stockActual: number
  aDescontar: number
  stockResultante: number
  lineas: number
}

interface LineaPendiente {
  itemId: number
  pedidoId: number
  mlOrderId: string
  fecha: string
  titulo: string
  cantidad: number
}

interface RespuestaConciliar {
  ok: boolean
  error?: string
  simulacion?: boolean
  productos?: ImpactoProducto[]
  conciliables?: LineaPendiente[]
  sinVincular?: { mlItemId: string | null; titulo: string; lineas: number; unidades: number }[]
  resultado?: { aplicadas: number; yaConciliadas: number; errores: { itemId: number; motivo: string }[]; pedidosConciliados: number }
}

function TarjetaConciliacion({ version, onAplicado }: { version: number; onAplicado: () => void }) {
  const [corriendo, setCorriendo] = useState(false)
  const [res, setRes] = useState<RespuestaConciliar | null>(null)
  const [verDetalle, setVerDetalle] = useState(false)

  const correr = useCallback(async (dryRun: boolean) => {
    setCorriendo(true)
    try {
      const r = await fetch('/api/ml/conciliar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dry_run: dryRun }),
      })
      const data: RespuestaConciliar = await r.json()
      setRes(data)
      if (!dryRun && data.ok) onAplicado()
    } catch (e) {
      setRes({ ok: false, error: e instanceof Error ? e.message : 'Error de red' })
    } finally {
      setCorriendo(false)
    }
  }, [onAplicado])

  // Al cambiar un vínculo, una simulación ya mostrada queda vieja: se rehace.
  useEffect(() => {
    if (version > 0) setRes(prev => (prev?.simulacion ? null : prev))
  }, [version])

  const conciliables = res?.conciliables ?? []
  const confirmar = () => {
    const unidades = conciliables.reduce((s, l) => s + l.cantidad, 0)
    if (window.confirm(`Se va a descontar stock de ${conciliables.length} línea(s) (${unidades} unidades). ¿Seguir?`)) {
      correr(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-5">
      <div className="text-[13px] font-medium text-gray-900">Descontar stock de ventas anteriores</div>
      <p className="text-[12px] text-gray-500 mt-0.5">
        Ventas de ML que entraron antes de vincular su publicación y no descontaron stock.
        Simulá para ver cuánto baja cada producto; si no alcanza, el stock queda negativo.
      </p>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => correr(true)}
          disabled={corriendo}
          className="text-[12px] px-3 py-1.5 rounded-lg font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {corriendo ? 'Procesando…' : 'Simular'}
        </button>
        {res?.ok && res.simulacion && conciliables.length > 0 && (
          <button
            onClick={confirmar}
            disabled={corriendo}
            className="text-[12px] px-3 py-1.5 rounded-lg font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Aplicar descuento
          </button>
        )}
      </div>

      {res && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          {!res.ok ? (
            <div className="text-[12px] text-red-600">Error: {res.error}</div>
          ) : !res.simulacion && res.resultado ? (
            <div className="text-[12px] text-gray-600 space-y-1">
              <div>
                ✓ Stock descontado en {res.resultado.aplicadas} línea(s) · {res.resultado.pedidosConciliados} pedido(s) conciliados
                {res.resultado.yaConciliadas > 0 && ` · ${res.resultado.yaConciliadas} ya estaban hechas`}
              </div>
              {res.resultado.errores.length > 0 && (
                <div className="text-red-600">
                  {res.resultado.errores.length} fallaron: {res.resultado.errores.map(e => `#${e.itemId} (${e.motivo})`).join(', ')}
                </div>
              )}
            </div>
          ) : (
            <>
              {(res.productos ?? []).length === 0 ? (
                <div className="text-[12px] text-gray-500">No hay ventas pendientes de publicaciones vinculadas.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-[11px] text-gray-400 uppercase tracking-wide text-left">
                        <th className="font-normal py-1">Producto</th>
                        <th className="font-normal py-1 text-right">Stock actual</th>
                        <th className="font-normal py-1 text-right">A descontar</th>
                        <th className="font-normal py-1 text-right">Queda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.productos!.map(p => (
                        <tr key={p.productoId} className="border-t border-gray-50">
                          <td className="py-1.5 text-gray-800">
                            {p.nombre}
                            {p.esKit && <span className="ml-1 text-[11px] text-amber-700">(kit: ajustar a mano)</span>}
                          </td>
                          <td className="py-1.5 text-right text-gray-600">{p.stockActual}</td>
                          <td className="py-1.5 text-right text-red-600">{p.aDescontar ? `− ${p.aDescontar}` : '—'}</td>
                          <td className={`py-1.5 text-right font-medium ${p.stockResultante < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {p.stockResultante}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {conciliables.length > 0 && (
                <button onClick={() => setVerDetalle(v => !v)} className="text-[12px] text-teal-700 hover:underline">
                  {verDetalle ? 'Ocultar' : 'Ver'} las {conciliables.length} ventas
                </button>
              )}
              {verDetalle && (
                <div className="space-y-1">
                  {conciliables.map(l => (
                    <div key={l.itemId} className="flex gap-3 text-[12px] text-gray-500">
                      <span className="shrink-0">{new Date(l.fecha).toLocaleDateString('es-AR')}</span>
                      <span className="shrink-0">Pedido #{l.pedidoId}</span>
                      <span className="truncate flex-1">{l.titulo}</span>
                      <span className="shrink-0">× {l.cantidad}</span>
                    </div>
                  ))}
                </div>
              )}

              {(res.sinVincular ?? []).length > 0 && (
                <div className="text-[12px] text-amber-700">
                  Quedan afuera ventas de publicaciones sin vincular:{' '}
                  {res.sinVincular!.map(s => `${s.titulo} (${s.unidades} u.)`).join(', ')}.
                  Vinculalas arriba y volvé a simular.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TarjetaImportaciones({ estado }: { estado: EstadoML }) {
  if (estado.importaciones.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-5">
      <div className="text-[13px] font-medium text-gray-900 mb-3">Últimas importaciones</div>
      <div className="space-y-1.5">
        {estado.importaciones.map((imp, i) => {
          const cfg = RESULTADO_CFG[imp.resultado] ?? { label: imp.resultado, cls: 'bg-gray-100 text-gray-500' }
          return (
            <div key={i} className="flex items-center gap-3 text-[12px] py-1 border-b border-gray-50 last:border-0">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.cls}`}>{cfg.label}</span>
              <span className="text-gray-500 shrink-0">#{imp.ml_order_id}</span>
              <span className="text-gray-400 truncate flex-1">{imp.detalle}</span>
              <span className="text-gray-400 shrink-0">{fechaHora(imp.created_at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MercadoLibrePage() {
  return (
    <Suspense fallback={<div className="h-32 rounded-xl bg-gray-100 animate-pulse max-w-4xl mx-auto" />}>
      <PageInner />
    </Suspense>
  )
}

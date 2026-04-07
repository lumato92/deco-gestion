// Tipos principales del schema

export type EstadoPedido =
  | 'presupuesto'
  | 'confirmado'
  | 'reservado'
  | 'en_fabricacion'
  | 'entregado'
  | 'cancelado'

export type MetodoPago = 'efectivo' | 'transferencia' | 'debito' | 'credito'
export type CanalVenta = 'directo' | 'whatsapp' | 'instagram' | 'tienda' | 'ecommerce'

export interface Cliente {
  id: number
  nombre: string
  telefono?: string
  email?: string
  canal?: CanalVenta
  notas?: string
  created_at: string
}

export interface Producto {
  id: number
  nombre: string
  tipo: 'propio' | 'reventa' | 'consignacion'
  categoria_id?: number
  subcategoria_id?: number
  stock: number
  costo: number
  precio: number
  minimo: number
  es_kit: boolean
  publicado: boolean
  destacado: boolean
  slug?: string
  descripcion_corta?: string
  estado: 'activo' | 'pausado' | 'descontinuado'
  // desde vista productos_con_margen:
  categoria_nombre?: string
  subcategoria_nombre?: string
  margen_pct?: number
  estado_stock?: 'ok' | 'medio' | 'bajo'
  imagen_principal?: string
}

export interface Insumo {
  id: number
  nombre: string
  categoria: string
  unidad: string
  stock: number
  costo: number
  minimo: number
  proveedor?: string
  proveedor_id?: number
  es_fabricable: boolean
  // desde vista insumos_con_estado:
  estado_stock?: 'ok' | 'medio' | 'bajo'
  valor_stock?: number
}

export interface PedidoConTotal {
  id: number
  cliente_id?: number
  cliente_nombre?: string
  cliente_telefono?: string
  cliente_email?: string
  origen_venta: 'presupuesto' | 'directa'
  estado: EstadoPedido
  canal_venta?: CanalVenta
  metodo_pago?: MetodoPago
  descuento_pct: number
  recargo_pct: number
  notas?: string
  fecha_pedido: string
  fecha_confirmacion?: string
  fecha_entrega?: string
  fecha_compromiso_fabricacion?: string
  fecha_llegada_fabricacion?: string
  cant_items: number
  subtotal: number
  costo_total: number
  total_cobrado: number
  ganancia: number
  cobrado: number
  pendiente: number
}

export interface ItemPedido {
  id: number
  pedido_id: number
  producto_id?: number
  nombre_producto?: string
  cantidad: number
  precio_unitario: number
  costo_unitario: number
  requiere_fabricacion?: boolean
  personalizacion_detalle?: Record<string, string>
}

export interface PagoPedido {
  id: number
  pedido_id: number
  tipo: 'seña' | 'adelanto' | 'saldo' | 'pago_total'
  metodo_pago: MetodoPago
  monto: number
  notas?: string
  created_at: string
}

export interface Gasto {
  id: number
  categoria: 'Insumos' | 'Fijo' | 'Flete' | 'Honorarios' | 'Publicidad' | 'Varios'
  descripcion: string
  monto: number
  fecha: string
  recurrente: boolean
  recurrente_id?: number
  proveedor?: string
  comprobante?: string
  metodo_pago: MetodoPago
  notas?: string
  created_at: string
}

export interface ResumenFinancieroMes {
  ingresos: number
  ganancia_bruta: number
  cant_pedidos: number
  total_gastos: number
  resultado_neto: number
}

export interface TopProductoMes {
  nombre_producto: string
  unidades_vendidas: number
  ingresos: number
  ganancia: number
}
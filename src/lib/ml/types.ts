// src/lib/ml/types.ts
//
// Tipos de la API de Mercado Libre. Explícitos a propósito: el webhook de MP
// usa `any` para fee_details y eso ya nos costó debugging a ciegas.
//
// Solo se tipa lo que consumimos. La respuesta real trae muchos más campos.

/** Notificación que ML postea al webhook. */
export interface NotificacionML {
  /** Path del recurso, ej: "/orders/2000012345678". */
  resource: string
  user_id: number
  topic: string
  application_id: number
  attempts: number
  sent: string
  received: string
}

/**
 * Estados de una orden.
 * Importamos solo 'paid': antes de eso la plata no está y el stock no debe moverse.
 */
export type EstadoOrdenML =
  | 'confirmed'
  | 'payment_required'
  | 'payment_in_process'
  | 'partially_paid'
  | 'paid'
  | 'partially_refunded'
  | 'pending_cancel'
  | 'cancelled'

export interface ItemML {
  /** ID de la publicación, ej "MLA123456789". Es la clave del match con productos. */
  id: string
  title: string
  variation_id?: number | null
  seller_sku?: string | null
}

export interface OrderItemML {
  item: ItemML
  quantity: number
  unit_price: number
  full_unit_price?: number
  /**
   * Comisión de ML **POR UNIDAD**, no por línea.
   *
   * Verificado contra órdenes reales: dos ventas del mismo producto, una de 2
   * unidades y otra de 4, traen exactamente el mismo sale_fee. Hay que
   * multiplicar por `quantity` — no hacerlo subestima la comisión y infla la
   * ganancia.
   *
   * Además se calcula al acreditarse el pago, no al crearse la orden, así que
   * puede venir 0 en una orden recién creada y llenarse después.
   */
  sale_fee: number
  currency_id?: string
}

export interface PagoML {
  id: number
  status: string
  transaction_amount: number
  date_approved?: string | null
  payment_method_id?: string | null
  installments?: number | null
  /** Envío cobrado dentro del pago (lo que puso el comprador). */
  shipping_cost?: number | null
  /** Impuestos del pago. En las ventas reales inspeccionadas viene 0. */
  taxes_amount?: number | null
  coupon_amount?: number | null
  overpaid_amount?: number | null
  total_paid_amount?: number | null
}

export interface CompradorML {
  id: number
  nickname?: string
  first_name?: string
  last_name?: string
}

export interface OrdenML {
  id: number
  status: EstadoOrdenML
  status_detail?: string | null
  date_created: string
  date_closed?: string | null
  total_amount: number
  currency_id?: string
  buyer?: CompradorML
  seller?: { id: number }
  order_items: OrderItemML[]
  payments?: PagoML[]
  /**
   * Impuestos de la orden. En las ventas reales inspeccionadas viene
   * `{amount: null}`, pero se lee igual por si ML empieza a informarlos.
   */
  taxes?: { amount: number | null; currency_id?: string | null } | null
  shipping?: { id: number } | null
}

/** Una parte (vendedor o comprador) dentro de los costos de un envío. */
export interface ParteEnvioML {
  user_id: number
  /** Lo que efectivamente paga esta parte, ya neto de descuentos. */
  cost: number
  save?: number
}

/**
 * Respuesta de /shipments/{id}/costs.
 *
 * `senders` es donde está el costo que absorbe el VENDEDOR: en un envío gratis
 * el comprador paga 0 y el vendedor se come el flete. Sin esto la ganancia
 * queda inflada.
 */
export interface CostosEnvioML {
  gross_amount?: number
  senders?: ParteEnvioML[]
  receiver?: ParteEnvioML | null
}

/** Respuesta del POST /oauth/token (authorization_code y refresh_token). */
export interface TokenML {
  access_token: string
  token_type: string
  /** Segundos de vida del access_token. Lo usamos tal cual en vez de hardcodear. */
  expires_in: number
  scope: string
  user_id: number
  refresh_token: string
}

/** Fila de ml_credenciales. */
export interface CredencialML {
  id: number
  seller_id: string
  nickname: string | null
  access_token: string
  refresh_token: string
  expires_at: string
  estado: 'activo' | 'degradado'
  ultimo_error: string | null
}

export type ResultadoImportacion =
  | 'importada'
  | 'duplicada'
  | 'sin_conciliar'
  | 'ignorada'
  | 'error'

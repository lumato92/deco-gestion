-- ============================================================================
-- Desglose de costos por venta y neto real
--
-- Hasta ahora `pagos_pedido.comisiones` guardaba comisión + envío + impuestos
-- sumados. Servía para que la ganancia diera bien sin tocar vistas, pero
-- impide ver de qué está hecho ese descuento.
--
-- Se parte en tres columnas y las vistas pasan a usar `deducciones`
-- (la suma de las tres), de modo que "qué se le descuenta a una venta" quede
-- definido en UN solo lugar: si mañana ML agrega otro cargo, se toca acá y se
-- propaga a todos los reportes.
--
-- ⚠️ Correr entero y de una: entre el ALTER y el reemplazo de las vistas, los
-- ingresos quedarían inflados (las vistas restarían solo la comisión).
-- ============================================================================


-- ── 1. Columnas nuevas ─────────────────────────────────────────────────────
ALTER TABLE public.pagos_pedido
  ADD COLUMN IF NOT EXISTS costo_envio numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impuestos   numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.pagos_pedido.comisiones  IS 'Comisión de la plataforma (MP o ML). Solo comisión.';
COMMENT ON COLUMN public.pagos_pedido.costo_envio IS 'Flete a cargo del vendedor, neto de bonificaciones.';
COMMENT ON COLUMN public.pagos_pedido.impuestos   IS 'Impuestos retenidos por la plataforma.';


-- ── 2. Separar lo que ya está mezclado ─────────────────────────────────────
-- Las 6 ventas de ML de julio se importaron con comisión y envío sumados en
-- `comisiones`. Se reparten con los valores reales de la API de ML.
-- La SUMA no cambia, así que los totales históricos quedan igual.
UPDATE public.pagos_pedido pp
SET comisiones  = v.comision,
    costo_envio = v.envio
FROM (VALUES
  ('2000017295739288'::text, 10498.3::numeric,    0::numeric),
  ('2000017358749428'::text, 14885.0::numeric, 4041::numeric),
  ('2000017384165292'::text, 14885.0::numeric, 4041::numeric),
  ('2000017447411172'::text, 43913.2::numeric,    0::numeric),
  ('2000017528990206'::text, 14885.0::numeric, 9860::numeric),
  ('2000017545943812'::text, 21956.6::numeric,    0::numeric)
) AS v(ml_order_id, comision, envio)
JOIN public.pedidos p ON p.ml_order_id = v.ml_order_id
WHERE pp.pedido_id = p.id;


-- ── 3. Vistas ──────────────────────────────────────────────────────────────
-- Se recrean las dos porque resumen_financiero_mes depende de pedidos_con_total.
DROP VIEW IF EXISTS public.resumen_financiero_mes;
DROP VIEW IF EXISTS public.pedidos_con_total CASCADE;

CREATE VIEW public.pedidos_con_total AS
SELECT t.*,
       -- Todo lo que la plataforma se queda de esta venta.
       (t.comisiones_mp + t.costo_envio + t.impuestos) AS deducciones,
       -- Lo que realmente entra: lo que paga el cliente menos las deducciones.
       round(t.total_cobrado - t.comisiones_mp - t.costo_envio - t.impuestos, 2) AS neto
FROM (
  SELECT p.id,
      p.cliente_id,
      p.origen_venta,
      p.estado,
      p.canal_venta,
      p.metodo_pago,
      p.descuento_pct,
      p.recargo_pct,
      p.notas,
      p.fecha_pedido,
      p.fecha_confirmacion,
      p.fecha_entrega,
      p.fecha_compromiso_fabricacion,
      p.fecha_llegada_fabricacion,
      p.created_at,
      p.updated_at,
      p.mp_link,
      c.nombre AS cliente_nombre,
      c.telefono AS cliente_telefono,
      c.email AS cliente_email,
      count(ip.id) AS cant_items,
      COALESCE(sum(ip.cantidad * ip.precio_unitario), 0::numeric) AS subtotal,
      COALESCE(sum(ip.cantidad * ip.costo_unitario), 0::numeric) AS costo_total,
      round(COALESCE(sum(ip.cantidad * ip.precio_unitario), 0::numeric) * (1::numeric - p.descuento_pct / 100::numeric) * (1::numeric + p.recargo_pct / 100::numeric), 2) AS total_cobrado,
      round(COALESCE(sum(ip.cantidad * ip.precio_unitario), 0::numeric) * (1::numeric - p.descuento_pct / 100::numeric) - COALESCE(sum(ip.cantidad * ip.costo_unitario), 0::numeric), 2) AS ganancia,
      COALESCE(( SELECT sum(pp.monto)
             FROM pagos_pedido pp
            WHERE pp.pedido_id = p.id), 0::numeric) AS cobrado,
      round(COALESCE(sum(ip.cantidad * ip.precio_unitario), 0::numeric) * (1::numeric - p.descuento_pct / 100::numeric) * (1::numeric + p.recargo_pct / 100::numeric) - COALESCE(( SELECT sum(pp.monto)
             FROM pagos_pedido pp
            WHERE pp.pedido_id = p.id), 0::numeric), 2) AS pendiente,
      COALESCE(( SELECT sum(pp.comisiones)
             FROM pagos_pedido pp
            WHERE pp.pedido_id = p.id), 0::numeric) AS comisiones_mp,
      -- Nuevas:
      COALESCE(( SELECT sum(pp.costo_envio)
             FROM pagos_pedido pp
            WHERE pp.pedido_id = p.id), 0::numeric) AS costo_envio,
      COALESCE(( SELECT sum(pp.impuestos)
             FROM pagos_pedido pp
            WHERE pp.pedido_id = p.id), 0::numeric) AS impuestos,
      -- Se exponen para el badge "sin conciliar" y para identificar la venta
      -- en Mercado Libre desde la UI.
      p.ml_order_id,
      p.conciliado
     FROM pedidos p
       LEFT JOIN clientes c ON c.id = p.cliente_id
       LEFT JOIN items_pedido ip ON ip.pedido_id = p.id
    GROUP BY p.id, p.cliente_id, p.origen_venta, p.estado, p.canal_venta, p.metodo_pago,
             p.descuento_pct, p.recargo_pct, p.notas, p.fecha_pedido, p.fecha_confirmacion,
             p.fecha_entrega, p.fecha_compromiso_fabricacion, p.fecha_llegada_fabricacion,
             p.created_at, p.updated_at, p.mp_link, c.nombre, c.telefono, c.email,
             p.ml_order_id, p.conciliado
) t;


-- Igual que antes, pero restando las tres deducciones en vez de solo comisiones.
CREATE VIEW public.resumen_financiero_mes AS
 SELECT COALESCE(sum(total_cobrado), 0::numeric) - COALESCE(sum(deducciones), 0::numeric) AS ingresos,
    COALESCE(sum(ganancia), 0::numeric) - COALESCE(sum(deducciones), 0::numeric) AS ganancia_bruta,
    count(id) AS cant_pedidos,
    COALESCE(( SELECT sum(g.monto) AS sum
           FROM gastos g
          WHERE date_trunc('month'::text, g.fecha::timestamp without time zone) = date_trunc('month'::text, now())), 0::numeric) AS total_gastos,
    COALESCE(sum(ganancia), 0::numeric) - COALESCE(sum(deducciones), 0::numeric) - COALESCE(( SELECT sum(g.monto) AS sum
           FROM gastos g
          WHERE date_trunc('month'::text, g.fecha::timestamp without time zone) = date_trunc('month'::text, now())), 0::numeric) AS resultado_neto
   FROM pedidos_con_total pct
  WHERE (estado = ANY (ARRAY['confirmado'::text, 'reservado'::text, 'en_fabricacion'::text, 'entregado'::text]))
    AND date_trunc('month'::text, fecha_confirmacion) = date_trunc('month'::text, now());


-- ── Verificación ───────────────────────────────────────────────────────────
-- Las 6 ventas de ML con su desglose. `deducciones` tiene que dar igual a lo
-- que antes estaba todo junto en comisiones_mp.
SELECT id, canal_venta, total_cobrado, comisiones_mp, costo_envio, impuestos, deducciones, neto
FROM public.pedidos_con_total
WHERE ml_order_id IS NOT NULL
ORDER BY id;

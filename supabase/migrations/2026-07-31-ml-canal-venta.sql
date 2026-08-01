-- ============================================================================
-- Módulo Mercado Libre — canal de venta 'mercadolibre' (cierra la Parte D)
--
-- La migración base dejó esto pendiente a propósito, porque reescribir un
-- CHECK sin ver su definición podía romper inserts existentes. Ya inspeccionada
-- la base, el constraint real es:
--
--   pedidos_canal_venta_check
--   CHECK (canal_venta = ANY (ARRAY['directo','whatsapp','instagram','tienda','ecommerce']))
--
-- O sea: columna text con lista blanca. Sin este cambio, el webhook falla al
-- insertar el pedido con canal_venta = 'mercadolibre'.
--
-- Los cinco valores originales se conservan tal cual; solo se suma el nuevo.
-- NULL sigue permitido: un CHECK que evalúa a NULL no rechaza la fila, así que
-- los pedidos viejos sin canal no se ven afectados.
-- ============================================================================

ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_canal_venta_check;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_canal_venta_check
  CHECK (canal_venta = ANY (ARRAY[
    'directo'::text,
    'whatsapp'::text,
    'instagram'::text,
    'tienda'::text,
    'ecommerce'::text,
    'mercadolibre'::text
  ]));


-- ── Verificación ───────────────────────────────────────────────────────────
-- Tiene que listar los 6 valores, con 'mercadolibre' incluido.
SELECT pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'public.pedidos'::regclass
  AND conname  = 'pedidos_canal_venta_check';

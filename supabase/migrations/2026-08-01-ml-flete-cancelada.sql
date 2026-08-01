-- ============================================================================
-- Módulo Mercado Libre — flete de ventas canceladas
--
-- Caso real (orden 2000017275632908, julio 2026): la venta se canceló pero el
-- envío ya se había despachado y entregado, así que ML facturó el flete igual.
-- Ese costo existe pero no tiene ningún pedido al que atribuirse, porque la
-- venta nunca ocurrió. Va como gasto de categoría Flete.
--
-- ml_order_id en gastos cumple la misma función que en pedidos: idempotencia.
-- ML reenvía notificaciones y el backfill se puede correr de nuevo; sin esto,
-- cada pasada duplicaría el gasto.
-- ============================================================================

ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS ml_order_id text;

CREATE UNIQUE INDEX IF NOT EXISTS gastos_ml_order_id_key
  ON public.gastos (ml_order_id)
  WHERE ml_order_id IS NOT NULL;   -- parcial: los gastos normales tienen NULL

COMMENT ON COLUMN public.gastos.ml_order_id IS
  'Orden de ML que originó el gasto (flete de una venta cancelada). Clave de idempotencia.';


-- ── Verificación ───────────────────────────────────────────────────────────
SELECT id, fecha, categoria, descripcion, monto, ml_order_id
FROM public.gastos
WHERE ml_order_id IS NOT NULL
ORDER BY fecha DESC;

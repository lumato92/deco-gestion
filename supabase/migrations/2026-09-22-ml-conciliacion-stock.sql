-- ============================================================================
-- Módulo Mercado Libre — conciliación de stock de ventas ya importadas
--
-- Hay dos tipos de ventas de ML que entraron sin descontar stock:
--
--   a) Sin producto: ml_publicaciones estuvo vacía, así que las líneas
--      entraron con producto_id = null.
--   b) Con stock insuficiente: descontar_stock_pedido es todo o nada; si a
--      una línea le faltaba stock no descontó NINGUNA. Se reconocen porque
--      el pedido no tiene su movimiento 'venta' (que el RPC solo inserta
--      cuando descuenta).
--
-- Para descontarlas después (con simulación previa desde la pantalla de ML):
--   1. items_pedido.ml_item_id: de qué publicación vino cada línea;
--   2. items_pedido.stock_conciliado_at: marca de "ya descontada acá";
--   3. RPC conciliar_item_ml: concilia UNA línea, idempotente, con la misma
--      lógica de kits y movimientos que descontar_stock_pedido, pero sin
--      validar stock (decisión de negocio: la venta ya ocurrió, el stock
--      puede quedar negativo).
--
-- Correr ENTERA y ANTES de deployar el código: el importador empieza a mandar
-- items_pedido.ml_item_id y el insert falla si la columna no existe.
-- ============================================================================


-- ── PARTE A — Columnas nuevas ──────────────────────────────────────────────

ALTER TABLE public.items_pedido
  ADD COLUMN IF NOT EXISTS ml_item_id text;

ALTER TABLE public.items_pedido
  ADD COLUMN IF NOT EXISTS stock_conciliado_at timestamptz;

-- Para buscar las líneas pendientes de una publicación.
CREATE INDEX IF NOT EXISTS items_pedido_ml_item_pendiente_idx
  ON public.items_pedido (ml_item_id)
  WHERE ml_item_id IS NOT NULL AND producto_id IS NULL;


-- ── PARTE B — Completar ml_item_id de las ventas ya importadas ─────────────
-- La orden completa quedó guardada en ml_importaciones.payload. Se matchea la
-- línea por título: nombre_producto se cargó con item.title tal cual.

WITH origen AS (
  SELECT DISTINCT ON (x.id)
         x.id                  AS item_id,
         li->'item'->>'id'     AS ml_item_id
  FROM public.items_pedido x
  JOIN public.pedidos p ON p.id = x.pedido_id
  JOIN LATERAL (
    SELECT mi.payload
    FROM public.ml_importaciones mi
    WHERE mi.ml_order_id = p.ml_order_id
      AND mi.payload IS NOT NULL
    ORDER BY mi.created_at DESC
    LIMIT 1
  ) imp ON true
  CROSS JOIN LATERAL jsonb_array_elements(imp.payload->'order_items') li
  WHERE p.ml_order_id IS NOT NULL
    AND x.ml_item_id IS NULL
    AND x.nombre_producto = li->'item'->>'title'
  ORDER BY x.id
)
UPDATE public.items_pedido ip
SET ml_item_id = o.ml_item_id
FROM origen o
WHERE ip.id = o.item_id;


-- ── PARTE C — RPC de conciliación de una línea ─────────────────────────────
--
-- Una línea es conciliable si es de una venta ML no cancelada, no se
-- concilió antes (stock_conciliado_at IS NULL) y además:
--   · no tiene producto (caso a) → se le asigna p_producto_id; o
--   · tiene producto = p_producto_id y el pedido no tiene movimiento 'venta'
--     (caso b: descontar_stock_pedido no descontó nada).
--
-- Cuando un pedido del caso b termina de descontar todas sus líneas con
-- producto, se inserta el movimiento 'venta' que el RPC original no llegó a
-- registrar. Eso también lo saca de la lista de pendientes.

CREATE OR REPLACE FUNCTION public.conciliar_item_ml(
  p_item_id     bigint,
  p_producto_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item          record;
  v_producto      record;
  v_sin_descuento boolean;
  v_sin_producto  integer;
  v_pendientes    integer;
BEGIN
  -- Bloquea la línea: dos conciliaciones simultáneas no pueden descontar dos veces.
  SELECT ip.id, ip.pedido_id, ip.producto_id, ip.cantidad, ip.stock_conciliado_at,
         p.canal_venta, p.estado
    INTO v_item
  FROM items_pedido ip
  JOIN pedidos p ON p.id = ip.pedido_id
  WHERE ip.id = p_item_id
  FOR UPDATE OF ip;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'item_inexistente');
  END IF;

  IF v_item.canal_venta <> 'mercadolibre' OR v_item.estado = 'cancelado' THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'pedido_no_valido');
  END IF;

  IF v_item.stock_conciliado_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'ya_conciliado');
  END IF;

  v_sin_descuento := NOT EXISTS (
    SELECT 1 FROM movimientos
    WHERE tipo = 'venta'
      AND referencia_tipo = 'pedido'
      AND referencia_id = v_item.pedido_id
  );

  -- Una línea con producto de un pedido que sí descontó ya está hecha.
  IF v_item.producto_id IS NOT NULL
     AND (v_item.producto_id <> p_producto_id OR NOT v_sin_descuento) THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'ya_conciliado');
  END IF;

  SELECT id, costo, es_kit
    INTO v_producto
  FROM productos
  WHERE id = p_producto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'producto_inexistente');
  END IF;

  UPDATE items_pedido
  SET producto_id         = p_producto_id,
      -- Solo se completa el costo si la línea no tenía producto: en el caso b
      -- el costo ya se cargó al importar.
      costo_unitario      = CASE WHEN producto_id IS NULL
                                 THEN COALESCE(v_producto.costo, 0)
                                 ELSE costo_unitario END,
      stock_conciliado_at = now()
  WHERE id = p_item_id;

  -- Mismo descuento que descontar_stock_pedido, sin validar stock.
  IF v_producto.es_kit THEN
    UPDATE productos pr
    SET stock = pr.stock - (ck.cantidad * v_item.cantidad)
    FROM componentes_kit ck
    WHERE ck.kit_id = p_producto_id
      AND pr.id = ck.producto_id;
  ELSE
    UPDATE productos
    SET stock = stock - v_item.cantidad
    WHERE id = p_producto_id;
  END IF;

  -- Conciliado = no le quedan líneas sin producto.
  SELECT count(*) INTO v_sin_producto
  FROM items_pedido
  WHERE pedido_id = v_item.pedido_id
    AND producto_id IS NULL;

  IF v_sin_producto = 0 THEN
    UPDATE pedidos SET conciliado = true WHERE id = v_item.pedido_id;
  END IF;

  -- Caso b: al terminar las líneas con producto, se registra la venta.
  IF v_sin_descuento THEN
    SELECT count(*) INTO v_pendientes
    FROM items_pedido
    WHERE pedido_id = v_item.pedido_id
      AND producto_id IS NOT NULL
      AND stock_conciliado_at IS NULL;

    IF v_pendientes = 0 THEN
      INSERT INTO movimientos (tipo, descripcion, referencia_id, referencia_tipo, origen)
      VALUES ('venta', 'Venta ML #' || v_item.pedido_id || ' (stock conciliado)',
              v_item.pedido_id, 'pedido', 'web');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pedido_id', v_item.pedido_id,
    'cantidad', v_item.cantidad,
    'pedido_conciliado', v_sin_producto = 0
  );
END;
$$;

COMMENT ON FUNCTION public.conciliar_item_ml(bigint, bigint) IS
  'Descuenta el stock de una línea de venta ML que no lo descontó al importarse (sin producto o por stock insuficiente). Soporta kits, stock puede quedar negativo. Idempotente.';


-- ── Verificación ───────────────────────────────────────────────────────────

-- 1. Líneas de ventas ML sin publicación de origen. Si aparece alguna, la
--    pantalla la completa re-leyendo la orden desde ML.
SELECT p.id AS pedido_id, p.ml_order_id, ip.id AS item_id, ip.nombre_producto
FROM public.items_pedido ip
JOIN public.pedidos p ON p.id = ip.pedido_id
WHERE p.ml_order_id IS NOT NULL
  AND ip.ml_item_id IS NULL;

-- 2. Pedidos ML que no descontaron stock por stock insuficiente (caso b).
SELECT p.id AS pedido_id, p.ml_order_id, p.fecha_pedido
FROM public.pedidos p
WHERE p.canal_venta = 'mercadolibre'
  AND p.estado <> 'cancelado'
  AND EXISTS (SELECT 1 FROM public.items_pedido ip
              WHERE ip.pedido_id = p.id AND ip.producto_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.movimientos m
                  WHERE m.tipo = 'venta' AND m.referencia_tipo = 'pedido'
                    AND m.referencia_id = p.id);

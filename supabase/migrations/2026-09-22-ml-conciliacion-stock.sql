-- ============================================================================
-- Módulo Mercado Libre — conciliación de stock de ventas ya importadas
--
-- Por qué: ml_publicaciones estuvo vacía, así que las ventas de ML entraron
-- con producto_id = null y sin descontar stock. Al vincular una publicación
-- con un producto, esas ventas viejas hay que descontarlas a mano (con
-- simulación previa desde la pantalla de ML). Para eso hace falta:
--   1. saber de qué publicación vino cada línea (items_pedido.ml_item_id);
--   2. un RPC que concilie UNA línea, idempotente, sin volver a descontar las
--      líneas del pedido que ya habían descontado al importarse.
--
-- Correr ENTERA y ANTES de deployar el código: el importador empieza a mandar
-- items_pedido.ml_item_id y el insert falla si la columna no existe.
-- ============================================================================


-- ── PARTE A — Publicación de origen de cada línea ──────────────────────────

ALTER TABLE public.items_pedido
  ADD COLUMN IF NOT EXISTS ml_item_id text;

-- Cuándo se descontó el stock de esta línea vía conciliación (no al importar).
-- Trazabilidad: permite distinguir y auditar los descuentos tardíos.
ALTER TABLE public.items_pedido
  ADD COLUMN IF NOT EXISTS stock_conciliado_at timestamptz;

-- Para buscar las líneas pendientes de una publicación.
CREATE INDEX IF NOT EXISTS items_pedido_ml_item_pendiente_idx
  ON public.items_pedido (ml_item_id)
  WHERE ml_item_id IS NOT NULL AND producto_id IS NULL;


-- ── PARTE B — Completar ml_item_id de las ventas ya importadas ─────────────
-- La orden completa quedó guardada en ml_importaciones.payload. Se matchea la
-- línea por título: nombre_producto se cargó con item.title tal cual.

-- El match se arma en un CTE con su propio alias de items_pedido: dentro del
-- FROM de un UPDATE (con JOIN LATERAL) Postgres no deja referenciar la tabla
-- que se está actualizando.
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
-- ⚠️ Revisar contra la definición de descontar_stock_pedido antes de correr
--    (SELECT pg_get_functiondef('public.descontar_stock_pedido'::regproc);).
--    Esta versión descuenta productos.stock directo y NO maneja kits: una línea
--    cuyo producto es kit se rechaza con motivo 'es_kit' en vez de descontar
--    mal. Si descontar_stock_pedido registra en movimientos o descompone kits,
--    hay que replicarlo acá.
--
-- Decisión de negocio: si no alcanza el stock se descuenta igual y queda
-- negativo. La venta ya ocurrió; el negativo marca que hay que ajustar
-- inventario.

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
  v_producto   record;
  v_item       record;
  v_stock      numeric;
  v_pendientes integer;
BEGIN
  SELECT id, costo, es_kit
    INTO v_producto
  FROM productos
  WHERE id = p_producto_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'producto_inexistente');
  END IF;

  IF v_producto.es_kit THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'es_kit');
  END IF;

  -- La guarda producto_id IS NULL es la idempotencia: una segunda corrida (o
  -- un doble click) no encuentra la fila y no descuenta dos veces.
  UPDATE items_pedido
  SET producto_id         = p_producto_id,
      costo_unitario      = COALESCE(v_producto.costo, 0),
      stock_conciliado_at = now()
  WHERE id = p_item_id
    AND producto_id IS NULL
  RETURNING id, pedido_id, cantidad
    INTO v_item;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'ya_conciliado');
  END IF;

  UPDATE productos
  SET stock = stock - v_item.cantidad
  WHERE id = p_producto_id
  RETURNING stock INTO v_stock;

  -- El pedido queda conciliado cuando ya no le quedan líneas sin producto.
  SELECT count(*) INTO v_pendientes
  FROM items_pedido
  WHERE pedido_id = v_item.pedido_id
    AND producto_id IS NULL;

  IF v_pendientes = 0 THEN
    UPDATE pedidos SET conciliado = true WHERE id = v_item.pedido_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pedido_id', v_item.pedido_id,
    'cantidad', v_item.cantidad,
    'stock_nuevo', v_stock,
    'pedido_conciliado', v_pendientes = 0
  );
END;
$$;

COMMENT ON FUNCTION public.conciliar_item_ml(bigint, bigint) IS
  'Asigna producto a una línea de venta ML sin conciliar y descuenta su stock (puede quedar negativo). Idempotente.';


-- ── Verificación ───────────────────────────────────────────────────────────
-- Líneas de ventas ML que siguen sin publicación de origen. Si aparece
-- alguna, la pantalla la completa re-leyendo la orden desde ML.
SELECT p.id AS pedido_id, p.ml_order_id, ip.id AS item_id, ip.nombre_producto
FROM public.items_pedido ip
JOIN public.pedidos p ON p.id = ip.pedido_id
WHERE p.ml_order_id IS NOT NULL
  AND ip.ml_item_id IS NULL;

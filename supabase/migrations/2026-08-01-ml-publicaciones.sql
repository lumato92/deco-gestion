-- ============================================================================
-- Módulo Mercado Libre — vínculo publicación ↔ producto (muchos a uno)
--
-- Por qué: el diseño original tenía `productos.ml_item_id`, o sea UNA
-- publicación por producto. En la cuenta real hay dos publicaciones distintas
-- del mismo producto ("Lampara Oval Hongo 18cm", una a $55.000 sin cuotas y
-- otra a $65.000 con cuotas). Con una sola columna, mapear la segunda pisa a
-- la primera y las ventas de la publicación perdedora entran sin conciliar
-- para siempre, sin descontar stock.
--
-- La tabla invierte la relación: la clave es la publicación (única, porque una
-- publicación pertenece a un solo producto) y muchas pueden apuntar al mismo
-- producto.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ml_publicaciones (
  -- PK: garantiza que una publicación no apunte a dos productos a la vez,
  -- que era la garantía que daba el UNIQUE de la columna vieja.
  ml_item_id  text PRIMARY KEY,
  producto_id bigint NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  -- Título en ML, solo para poder revisar el mapeo sin ir a buscarlo a la API.
  titulo      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Para listar las publicaciones de un producto.
CREATE INDEX IF NOT EXISTS ml_publicaciones_producto_idx
  ON public.ml_publicaciones (producto_id);

COMMENT ON TABLE public.ml_publicaciones IS
  'Vincula publicaciones de ML con productos internos. Muchas publicaciones pueden apuntar al mismo producto.';


-- ── Migrar lo que hubiera en la columna vieja ──────────────────────────────
-- Hoy son 0 filas (ningún producto quedó mapeado), pero se hace igual para
-- que la migración sea correcta si alguien cargó algo mientras tanto.
INSERT INTO public.ml_publicaciones (ml_item_id, producto_id)
SELECT ml_item_id, id
FROM public.productos
WHERE ml_item_id IS NOT NULL
ON CONFLICT (ml_item_id) DO NOTHING;


-- ── Eliminar la columna vieja ──────────────────────────────────────────────
-- Se va para no dejar dos fuentes de verdad sobre "de qué producto es esta
-- publicación". Los datos ya se copiaron arriba.
DROP INDEX IF EXISTS public.productos_ml_item_id_key;

ALTER TABLE public.productos
  DROP COLUMN IF EXISTS ml_item_id;


-- ── Verificación ───────────────────────────────────────────────────────────
SELECT p.ml_item_id, p.titulo, pr.id AS producto_id, pr.nombre, pr.stock
FROM public.ml_publicaciones p
JOIN public.productos pr ON pr.id = p.producto_id
ORDER BY pr.nombre;

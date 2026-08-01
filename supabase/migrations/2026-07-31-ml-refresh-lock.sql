-- ============================================================================
-- Módulo Mercado Libre — serialización del refresh de token (PR2 / tarea T8)
-- Correr DESPUÉS de 2026-07-31-modulo-ml.sql.
--
-- Problema: el refresh_token de ML es de un solo uso (confirmado en la doc de
-- ML: "el REFRESH_TOKEN solo puede ser usado una vez"). Si dos webhooks entran
-- a la vez y ambos ven el access_token vencido, los dos intentan refrescar: el
-- primero rota el token y el segundo presenta uno ya quemado. ML rechaza al
-- segundo y la cuenta cae a DEGRADADO sin que haya pasado nada malo de verdad.
--
-- Por qué no un advisory lock de sesión: PostgREST usa un pool de conexiones y
-- no garantiza que dos llamadas HTTP caigan en la misma conexión, así que un
-- pg_advisory_lock tomado en una request no se puede sostener hasta la
-- siguiente. La solución que sí funciona sobre un pool es un claim atómico:
-- un UPDATE condicional donde el lock de fila de Postgres decide un único
-- ganador.
-- ============================================================================

-- Hasta cuándo hay un refresh en curso. NULL o pasado = nadie está refrescando.
ALTER TABLE public.ml_credenciales
  ADD COLUMN IF NOT EXISTS refresh_lock_hasta timestamptz;


-- Devuelve true SOLO al que gana el derecho a refrescar.
--
-- Los perdedores reciben false, esperan, y releen el token que dejó el ganador.
-- El lock se autovence a los p_segundos para que un handler que se muera a
-- mitad de camino no deje la cuenta trabada para siempre.
CREATE OR REPLACE FUNCTION public.ml_reclamar_refresh(
  p_seller_id text,
  p_segundos  int DEFAULT 30
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gano boolean;
BEGIN
  -- El UPDATE toma un lock de fila. Si dos transacciones entran juntas, la
  -- segunda espera y vuelve a evaluar el WHERE con el valor ya escrito por la
  -- primera (READ COMMITTED), así que no matchea y no actualiza nada.
  UPDATE public.ml_credenciales
     SET refresh_lock_hasta = now() + make_interval(secs => p_segundos)
   WHERE seller_id = p_seller_id
     AND (refresh_lock_hasta IS NULL OR refresh_lock_hasta < now())
  RETURNING true INTO v_gano;

  RETURN COALESCE(v_gano, false);
END;
$$;

COMMENT ON FUNCTION public.ml_reclamar_refresh IS
  'Claim atómico del derecho a refrescar el token de ML. Un solo ganador por ventana.';


-- Libera el lock cuando el refresh terminó (bien o mal), sin esperar a que
-- venza solo. Que el próximo webhook no coma 30 segundos de espera al pedo.
CREATE OR REPLACE FUNCTION public.ml_liberar_refresh(p_seller_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ml_credenciales
     SET refresh_lock_hasta = NULL
   WHERE seller_id = p_seller_id;
$$;


-- ── Verificación ───────────────────────────────────────────────────────────
-- Tiene que devolver true y después false: el segundo llamado es el "perdedor".
--   SELECT public.ml_reclamar_refresh('TU_SELLER_ID');  -- true
--   SELECT public.ml_reclamar_refresh('TU_SELLER_ID');  -- false
--   SELECT public.ml_liberar_refresh('TU_SELLER_ID');

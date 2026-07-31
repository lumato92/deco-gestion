# TODOS — Deco Gestión

## Diferido desde el review de ML (2026-07-31)

- [ ] **Sync de stock interno → ML** (P2) — Cuando baja el stock por otro canal, actualizar la cantidad en la publicación de ML (PUT item quantity) para no sobrevender. El baseline ya guarda `productos.ml_item_id`, así que no hay retrabajo de esquema. Riesgo: rate limits de la API de escritura. Depende de: módulo ML baseline shippeado.
- [ ] **Preguntas y mensajes de ML** (P3) — Webhook topic `questions` + endpoint para responder desde la app. Superficie nueva (bandeja, estado leído/respondido). No comparte esquema con ventas.
- [ ] **Mercado Envíos** (P3) — Traer estado de envío y tracking de cada orden desde el recurso `shipment`, mostrarlo junto al pedido. El baseline guarda `ml_order_id`, se enriquece sin migración grande.
- [ ] **Multi-cuenta ML** (P3) — Soportar varios `seller_id`. El baseline ya usa tabla `ml_credenciales`, así que pasar de una a varias cuentas es acotado. Depende de: tener una segunda cuenta real.

## Deuda técnica detectada en el review

- [ ] **Migrar el webhook de MP a cliente service-role** (P2) — `src/app/api/pagos/webhook/route.ts` hoy escribe con `@/lib/supabase/server` (anon key + cookies), pero un webhook no tiene cookies: escribe como anónimo dependiendo de RLS. Una vez creado `src/lib/supabase/admin.ts` (tarea T1 del módulo ML), migrar este webhook al mismo cliente para cerrar el riesgo de falla silenciosa. Bajo riesgo, alto valor de robustez.

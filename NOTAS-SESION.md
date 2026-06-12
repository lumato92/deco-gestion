# Notas de sesión — deco-gestion

> Handoff de contexto para retomar el trabajo en un chat nuevo de Claude Code
> abierto directamente en esta carpeta. Última actualización: 2026-06-11.

## Stack
- Next.js 16 + React 19 (¡leer `node_modules/next/dist/docs/` antes de tocar APIs de Next, hay breaking changes!).
- Supabase (Postgres + auth propia con bcrypt), MercadoPago (Point + link online), TailwindCSS v4, Recharts, @react-pdf/renderer, lucide-react.
- Credenciales en `.env.local` (no commitear). Misma instancia de Supabase para dev y prod.

## Estrategia de ramas
- **`modulo-compras`** es la rama de trabajo principal (la que se deploya en Vercel). `main` es un espejo.
- Flujo: rama feature desde `modulo-compras` → PR → merge → `git pull` en `modulo-compras`.
- Herramientas: `gh` CLI instalado y autenticado. Repo: https://github.com/lumato92/deco-gestion

## Trabajo hecho en esta sesión (PRs)
- **#4** ventas: mejoras de formulario y edición de fecha.
- **#5** presupuestos: edición desde el listado + fix de descuento en PDF.
- **#6** finanzas: comisiones MP descontadas del ingreso neto.
- **#7** gastos: filtro de fechas funcional, débito=banco, orden, modal de borrado, fallback a últimos gastos.
- **#8** finanzas: selector de mes, top productos, ventas por canal, pedidos con pérdida, cuentas por cobrar, caja vs banco, inventario, ticket promedio, margen neto, comparación mes vs mes.
- **#9** ui: **modo oscuro + íconos en el sidebar** — ⚠️ **ABIERTO, falta mergear** a `modulo-compras`.

## Migraciones SQL ya aplicadas en Supabase (no volver a correr)
- `descontar_stock_pedido`: recreada con `SECURITY DEFINER` + `SET search_path=public`; eliminada la versión duplicada con firma `bigint`.
- `pagos_pedido.comisiones numeric NOT NULL DEFAULT 0`.
- Vista `pedidos_con_total`: agregada columna `comisiones_mp` (al final).
- Vista `resumen_financiero_mes`: resta comisiones del ingreso/ganancia/resultado.
- Backfill de comisiones MP históricas (9 ventas Point, $81.870,75) parseadas desde `pagos_pedido.notas`.

## Decisiones / gotchas importantes
- **Descuento de stock**: el pedido se crea siempre en estado `confirmado`, se llama al RPC `descontar_stock_pedido`, y recién después se pasa a `entregado` si es entrega inmediata.
- **Ingreso neto**: las vistas restan `comisiones_mp`. El bruto (`monto`) se sigue usando para saldar pedidos; nunca guardar el neto en `monto` (rompe la lógica de `pendiente`/entregado).
- **Finanzas** (`use-finanzas.ts`): carga una ventana de 12 meses una vez y deriva todo client-side según el mes seleccionado. Estados que cuentan como venta: `confirmado, reservado, en_fabricacion, entregado`.
- **Dark mode** (rama #9): tokens semánticos en `globals.css` — `bg-surface` para superficies + remapeo de la escala de grises de Tailwind bajo `.dark`. `text-white` se mantiene (botones de color). Toggle en el sidebar, persistido en localStorage, con script anti-parpadeo en `layout.tsx`.

## Pendiente / backlog
- Mergear **PR #9** (dark mode).
- Refinar dark mode: colores de líneas de Recharts y chips de color; extraer componentes compartidos (Card, Modal, Badge, EmptyState).
- **Fase 4 de finanzas**: punto de equilibrio, presupuesto de gastos vs real, proyección de cierre.
- Ideas de features priorizadas: tablero de producción (kanban), enviar presupuesto por WhatsApp, alertas de stock bajo, arqueo de caja diario.

## Comandos útiles
- Type-check: `npx tsc --noEmit`
- Build: `npm run build`
- Dev: `npm run dev`

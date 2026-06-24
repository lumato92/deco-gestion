@AGENTS.md
# Deco Gestión — SU Home

Sistema de gestión operativa para **SU Home**, negocio de decoración y diseño en Buenos Aires.
Desarrollado y mantenido en solitario por Lucas.

---

## Stack tecnológico

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Estilos**: Tailwind CSS
- **Base de datos**: Supabase (PostgreSQL) — proyecto `kxybejhkzdfhhamnceva.supabase.co`
- **Deploy**: Vercel (auto-deploy en push a `main`)
- **PDF**: `@react-pdf/renderer` + `qrcode`
- **Pagos**: Mercado Pago Point (webhooks IPN)
- **Automatización**: n8n (hosted en Render) + Telegram Bot + Google Gemini API

---

## Comandos esenciales

```bash
npm run dev       # Servidor local en localhost:3000
npm run build     # Build de producción
npm run lint      # Linter
```

---

## Variables de entorno

El archivo `.env.local` debe tener:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MP_ACCESS_TOKEN=
```

---

## Estructura del proyecto

```
src/
  app/
    (dashboard)/         # Layout principal autenticado
      dashboard/         # Métricas, widgets, resumen
      inventario/        # Insumos y productos
      ventas/            # Presupuestos y ventas directas
      compras/           # Compras directas y órdenes de compra (OC)
      gastos/            # Registro de gastos
      fabricacion/       # Órdenes de fabricación
      reportes/          # Resumen financiero
    api/
      pagos/point/       # Webhooks de Mercado Pago Point
      pdf/               # Generación de PDFs (presupuesto, ticket, remito, resumen)
      webhooks/          # Otros webhooks
  components/            # Componentes reutilizables
  lib/
    supabase/            # Clientes de Supabase (browser y server)
    hooks/               # Custom hooks (use-nueva-venta, etc.)
    utils/               # Helpers generales
```

---

## Base de datos (Supabase)

**Tablas principales**: `ventas`, `lineas_venta`, `insumos`, `productos`, `proveedores`,
`compras`, `lineas_compra`, `ordenes_compra`, `lineas_orden_compra`, `gastos`,
`fabricacion_ordenes`, `pagos_point`

**Objetos especiales**:
- Secuencia Postgres + trigger BEFORE INSERT para numeración automática de OC (`OC-0001`)
- RPCs para operaciones complejas (descuento de stock, etc.)
- Vistas para reportes financieros

> ⚠️ **IMPORTANTE**: Claude Code no tiene acceso directo a la base de datos.
> Para cualquier cambio de esquema, nueva migración, RPC, trigger o vista,
> generar el SQL correspondiente para que Lucas lo ejecute en el SQL Editor de Supabase.
> Siempre usar `DROP VIEW ... CASCADE` antes de alterar columnas con vistas dependientes.

---

## Reglas críticas de Supabase

- Las rutas API que hacen **mutaciones** (UPDATE, INSERT) deben usar el **cliente browser**
  (`createClientComponentClient`), no el cliente server — el server client falla silenciosamente
  sin contexto de cookies.
- El cliente server se usa solo para lecturas en Server Components o Route Handlers de solo lectura.

---

## Patrones de código establecidos

### Generación de PDFs
```ts
// ✅ Correcto: React.createElement inline en el route handler
const doc = React.createElement(Document, null, React.createElement(Page, ...))
const buffer = await renderToBuffer(doc)
return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf' } })

// Frontend: usar <a href="/api/pdf/..."> con target="_blank"
```

### Creación de entidades inline
Los flujos de venta y compra soportan creación inline de proveedores, insumos y productos
sin salir del flujo principal. Respetar este patrón al agregar nuevas entidades.

### Mercado Pago Point (webhooks)
- MP envía formato IPN: campos `topic` y `resource` (no el formato moderno de webhooks)
- Los pagos reales tienen `external_reference: "Venta presencial"` y `operation_type === 'pos_payment'`
- La detección es dual-format (IPN + webhook moderno) para compatibilidad
- Flag `desde_point: boolean` en ventas para evitar duplicación de pagos

---

## Deploy

El deploy es automático: `git push origin main` → Vercel detecta el push y deploya.
Variables de entorno de producción se configuran en el dashboard de Vercel (no en código).

---

## Módulos en desarrollo / deuda técnica conocida

- [ ] Bug: RPC `descontar_stock_pedido` puede no existir — pendiente verificar y crear si falta
- [ ] Ventas directas: el estado debería defaultear a `"confirmada"` con opción de marcar
      entrega al momento de la venta (actualmente defaultea a `"entregada"`)
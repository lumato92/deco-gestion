'use client'

// ============================================================
//  src/hooks/use-realtime.ts
//  Hook genérico que escucha cambios en una o varias tablas
//  y ejecuta un callback cuando hay INSERT, UPDATE o DELETE.
//  Se puede reutilizar en cualquier hook de datos.
// ============================================================

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseRealtimeOptions {
  tablas: string[]          // tablas a escuchar
  onCambio: () => void      // qué hacer cuando hay un cambio
  habilitado?: boolean      // para desactivar si la pantalla no está visible
}

export function useRealtime({
  tablas,
  onCambio,
  habilitado = true,
}: UseRealtimeOptions) {
  useEffect(() => {
    if (!habilitado) return

    const supabase = createClient()
    const nombreCanal = `realtime-${tablas.join('-')}-${Date.now()}`

    const canal = supabase.channel(nombreCanal)

    tablas.forEach(tabla => {
      canal.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: tabla },
        () => onCambio()
      )
    })

    canal.subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [tablas.join(','), habilitado])
}


// ============================================================
//  IMPORTANTE: Para que realtime funcione en Supabase,
//  tenés que habilitar la replicación en cada tabla.
//  Ejecutá esto en el SQL Editor de Supabase:
//
//  ALTER TABLE pedidos          REPLICA IDENTITY FULL;
//  ALTER TABLE items_pedido     REPLICA IDENTITY FULL;
//  ALTER TABLE pagos_pedido     REPLICA IDENTITY FULL;
//  ALTER TABLE gastos           REPLICA IDENTITY FULL;
//  ALTER TABLE gastos_recurrentes REPLICA IDENTITY FULL;
//  ALTER TABLE productos        REPLICA IDENTITY FULL;
//  ALTER TABLE insumos          REPLICA IDENTITY FULL;
//  ALTER TABLE clientes         REPLICA IDENTITY FULL;
//  ALTER TABLE movimientos      REPLICA IDENTITY FULL;
//
//  Y en Supabase dashboard → Database → Replication,
//  activar el toggle de cada tabla en la lista.
// ============================================================
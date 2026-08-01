// src/lib/ml/alertas.ts
//
// T5 — Alertas. La regla del plan es "cero fallas silenciosas": si algo se
// rompe y nadie se entera, el módulo muere sin ruido y las ventas dejan de
// entrar durante días.
//
// Manda a un webhook configurable (el n8n / bot de Telegram que ya existe en
// el stack). Si no hay URL configurada, deja el aviso en los logs igual —
// degradado, pero nunca en silencio.

export type NivelAlerta = 'info' | 'atencion' | 'critico'

export interface Alerta {
  nivel: NivelAlerta
  titulo: string
  detalle: string
  contexto?: Record<string, unknown>
}

const EMOJI: Record<NivelAlerta, string> = {
  info: 'ℹ️',
  atencion: '⚠️',
  critico: '🚨',
}

/**
 * Envía una alerta. Nunca tira excepción: una alerta que falla no puede
 * tumbar la importación de una venta que ya ocurrió.
 */
export async function enviarAlerta(alerta: Alerta): Promise<void> {
  const texto = `${EMOJI[alerta.nivel]} ${alerta.titulo}\n${alerta.detalle}`

  // El log va siempre, haya o no webhook: es el registro de última instancia.
  console[alerta.nivel === 'critico' ? 'error' : 'warn'](
    `[ml][alerta][${alerta.nivel}] ${alerta.titulo} — ${alerta.detalle}`,
    alerta.contexto ?? {}
  )

  const url = process.env.ML_ALERTAS_WEBHOOK_URL
  if (!url) return

  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        origen: 'deco-gestion/ml',
        nivel: alerta.nivel,
        titulo: alerta.titulo,
        detalle: alerta.detalle,
        texto,
        contexto: alerta.contexto ?? {},
        ts: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    })

    if (!respuesta.ok) {
      console.error('[ml][alerta] el webhook de alertas respondió', respuesta.status)
    }
  } catch (e) {
    console.error(
      '[ml][alerta] no se pudo enviar la alerta:',
      e instanceof Error ? e.message : e
    )
  }
}

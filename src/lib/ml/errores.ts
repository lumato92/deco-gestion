// src/lib/ml/errores.ts
//
// Un tipo de error por modo de falla del Error & Rescue Map del plan.
// La gracia es que cada uno se rescata distinto: el 401 refresca y reintenta,
// el 429 espera, el de refresh degrada la cuenta y alerta. Un `catch (e)`
// genérico no puede distinguirlos, y por eso no lo usamos en ningún lado.

export class MLError extends Error {
  constructor(mensaje: string, public readonly contexto?: Record<string, unknown>) {
    super(mensaje)
    this.name = new.target.name
  }
}

/** 401: el access_token venció o fue revocado. Se refresca y se reintenta 1 vez. */
export class MLAuthError extends MLError {}

/** 429: rate limit. Se espera y se reintenta. */
export class MLRateLimitError extends MLError {
  constructor(mensaje: string, public readonly esperaMs: number, contexto?: Record<string, unknown>) {
    super(mensaje, contexto)
  }
}

/** Timeout o falla de red hablando con ML. Se reintenta. */
export class MLNetworkError extends MLError {}

/** La respuesta no es el JSON que esperábamos. NO se reintenta: reintentar no lo arregla. */
export class MLParseError extends MLError {}

/**
 * El refresh_token ya no sirve. Es el modo de falla más grave del módulo:
 * sin rescate automático, la cuenta queda DEGRADADA hasta que alguien
 * reconecte a mano. Siempre alerta.
 */
export class MLRefreshError extends MLError {}

/** No hay credenciales cargadas: nunca se conectó la cuenta. */
export class MLSinCredencialesError extends MLError {}

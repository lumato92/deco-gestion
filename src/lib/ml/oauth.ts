// src/lib/ml/oauth.ts
//
// Constantes compartidas entre las dos mitades del flujo OAuth.
// Viven acá y no en un route.ts porque Next valida los exports de esos
// archivos: solo acepta handlers HTTP y config de segmento.

/** Cookie donde viaja el `state` entre /oauth/iniciar y /oauth/callback. */
export const COOKIE_STATE = 'ml_oauth_state'

/** Pantalla a la que se vuelve al terminar (bien o mal) la conexión. */
export const RUTA_INTEGRACION = '/dashboard/integraciones/mercadolibre'

// Tests del ciclo de vida del token.
//
// El caso central es el race de T8: el refresh_token de ML es de un solo uso,
// así que dos handlers concurrentes NO pueden llamar a ML los dos.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calcularExpiracion, obtenerAccessToken } from './credenciales'
import { MLRefreshError } from './errores'

vi.mock('./alertas', () => ({ enviarAlerta: vi.fn(async () => {}) }))
import { enviarAlerta } from './alertas'
const alertaMock = vi.mocked(enviarAlerta)

const VENCIDO = new Date(Date.now() - 60_000).toISOString()
const VIGENTE = new Date(Date.now() + 3_600_000).toISOString()

interface EstadoFake {
  expires_at: string
  estado: 'activo' | 'degradado'
  access_token: string
  lockTomado: boolean
}

/**
 * Fake de Supabase con el comportamiento real del claim: el primero que
 * llama a ml_reclamar_refresh gana, el resto pierde.
 */
function fakeSupabase(inicial: Partial<EstadoFake> = {}) {
  const estado: EstadoFake = {
    expires_at: inicial.expires_at ?? VENCIDO,
    estado: inicial.estado ?? 'activo',
    access_token: inicial.access_token ?? 'TOKEN-VIEJO',
    lockTomado: false,
  }

  const rpcs: string[] = []

  const cliente = {
    from() {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: fila(), error: null }),
          }),
          limit: () => ({
            maybeSingle: async () => ({ data: fila(), error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: async () => {
            if (payload.estado) estado.estado = payload.estado as 'activo' | 'degradado'
            return { data: null, error: null }
          },
        }),
        upsert: async (payload: Record<string, unknown>) => {
          estado.access_token = payload.access_token as string
          estado.expires_at = payload.expires_at as string
          estado.estado = 'activo'
          estado.lockTomado = false
          return { data: null, error: null }
        },
      }
    },
    async rpc(nombre: string) {
      rpcs.push(nombre)
      if (nombre === 'ml_reclamar_refresh') {
        if (estado.lockTomado) return { data: false, error: null }
        estado.lockTomado = true
        return { data: true, error: null }
      }
      if (nombre === 'ml_liberar_refresh') {
        estado.lockTomado = false
        return { data: null, error: null }
      }
      return { data: null, error: null }
    },
  }

  function fila() {
    return {
      id: 1,
      seller_id: '123',
      nickname: 'SUHOME',
      access_token: estado.access_token,
      refresh_token: 'REFRESH-1',
      expires_at: estado.expires_at,
      estado: estado.estado,
      ultimo_error: null,
    }
  }

  return { supabase: cliente as never, estado, rpcs }
}

beforeEach(() => {
  alertaMock.mockClear()
  process.env.ML_CLIENT_ID = 'app-id'
  process.env.ML_CLIENT_SECRET = 'secret'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Stub de fetch que cuenta cuántas veces se llamó al endpoint de token. */
function stubToken(respuesta: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 400,
    text: async () => JSON.stringify(respuesta),
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('token vigente', () => {
  it('no refresca si todavía no venció', async () => {
    const { supabase, rpcs } = fakeSupabase({ expires_at: VIGENTE, access_token: 'TOKEN-OK' })
    const fetchMock = stubToken({})

    const token = await obtenerAccessToken(supabase)

    expect(token).toBe('TOKEN-OK')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(rpcs).toEqual([])
  })
})

describe('refresh serializado (T8)', () => {
  it('refresca y guarda el token nuevo', async () => {
    const { supabase, estado } = fakeSupabase()
    const fetchMock = stubToken({
      access_token: 'TOKEN-NUEVO',
      refresh_token: 'REFRESH-2',
      expires_in: 21600,
      token_type: 'bearer',
      scope: 'offline_access read',
      user_id: 123,
    })

    const token = await obtenerAccessToken(supabase)

    expect(token).toBe('TOKEN-NUEVO')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(estado.access_token).toBe('TOKEN-NUEVO')
  })

  it('dos llamadas concurrentes queman el refresh_token UNA sola vez', async () => {
    const { supabase } = fakeSupabase()
    const fetchMock = stubToken({
      access_token: 'TOKEN-NUEVO',
      refresh_token: 'REFRESH-2',
      expires_in: 21600,
      token_type: 'bearer',
      scope: 'offline_access read',
      user_id: 123,
    })

    // Las dos arrancan viendo el token vencido, como dos webhooks simultáneos.
    const [a, b] = await Promise.all([
      obtenerAccessToken(supabase),
      obtenerAccessToken(supabase),
    ])

    // Esto es lo que evita que ML invalide la cuenta:
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toBe('TOKEN-NUEVO')
    expect(b).toBe('TOKEN-NUEVO')
  })
})

describe('degradación', () => {
  it('marca degradada y alerta si ML rechaza el refresh', async () => {
    const { supabase, estado } = fakeSupabase()
    stubToken({ error: 'invalid_grant' }, false)

    await expect(obtenerAccessToken(supabase)).rejects.toBeInstanceOf(MLRefreshError)

    expect(estado.estado).toBe('degradado')
    expect(alertaMock).toHaveBeenCalledWith(
      expect.objectContaining({ nivel: 'critico', titulo: 'Mercado Libre desconectado' })
    )
  })

  it('una cuenta ya degradada no reintenta sola', async () => {
    const { supabase } = fakeSupabase({ estado: 'degradado' })
    const fetchMock = stubToken({})

    await expect(obtenerAccessToken(supabase)).rejects.toBeInstanceOf(MLRefreshError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('calcularExpiracion', () => {
  it('usa el expires_in que manda ML en vez de un valor fijo', () => {
    const base = new Date('2026-07-31T12:00:00.000Z').getTime()
    expect(calcularExpiracion(21600, base)).toBe('2026-07-31T18:00:00.000Z')
  })
})

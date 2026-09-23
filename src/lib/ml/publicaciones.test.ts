import { describe, it, expect, vi, beforeEach } from 'vitest'
import { idsPublicacionesActivas, detallePublicaciones } from './publicaciones'

vi.mock('./client', () => ({ getML: vi.fn() }))
import { getML } from './client'
const getMLMock = vi.mocked(getML)

beforeEach(() => getMLMock.mockReset())

const supabase = {} as never

describe('idsPublicacionesActivas', () => {
  it('pagina hasta cubrir el total', async () => {
    const primera = Array.from({ length: 50 }, (_, i) => `MLA${i}`)
    getMLMock
      .mockResolvedValueOnce({ results: primera, paging: { total: 52 } })
      .mockResolvedValueOnce({ results: ['MLA50', 'MLA51'], paging: { total: 52 } })

    const ids = await idsPublicacionesActivas(supabase, '123')

    expect(ids).toHaveLength(52)
    expect(getMLMock).toHaveBeenCalledTimes(2)
    expect(String(getMLMock.mock.calls[1][1])).toContain('offset=50')
    expect(String(getMLMock.mock.calls[0][1])).toContain('/users/123/items/search?status=active')
  })

  it('corta si la cuenta no tiene publicaciones', async () => {
    getMLMock.mockResolvedValueOnce({ results: [], paging: { total: 0 } })
    expect(await idsPublicacionesActivas(supabase, '123')).toEqual([])
  })
})

describe('detallePublicaciones', () => {
  it('pide de a 20 y descarta las entradas con error', async () => {
    const ids = Array.from({ length: 21 }, (_, i) => `MLA${i}`)
    getMLMock
      .mockResolvedValueOnce([
        { code: 200, body: { id: 'MLA0', title: 'Lámpara', price: 55000, available_quantity: 3, status: 'active' } },
        { code: 404, body: { id: 'MLA1' } },
      ])
      .mockResolvedValueOnce([
        { code: 200, body: { id: 'MLA20', title: 'Espejo', price: 30000, available_quantity: 1, status: 'active' } },
      ])

    const pubs = await detallePublicaciones(supabase, ids)

    expect(getMLMock).toHaveBeenCalledTimes(2)
    expect(pubs.map(p => p.id)).toEqual(['MLA0', 'MLA20'])
  })
})

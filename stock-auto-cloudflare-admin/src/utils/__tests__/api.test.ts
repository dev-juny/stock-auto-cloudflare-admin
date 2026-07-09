import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

// SessionStorage mock
const store: Record<string, string> = {}
const mockSessionStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) },
  get length() { return Object.keys(store).length },
  key: (i: number) => Object.keys(store)[i] || null,
}
Object.defineProperty(global, 'sessionStorage', { value: mockSessionStorage })

describe('api utility', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockSessionStorage.clear()
  })

  describe('token management', () => {
    it('should store and retrieve token', async () => {
      const { setToken, getToken, hasToken, clearToken } = await import('../api')
      expect(hasToken()).toBe(false)
      setToken('test-token')
      expect(getToken()).toBe('test-token')
      expect(hasToken()).toBe(true)
      clearToken()
      expect(hasToken()).toBe(false)
    })
  })

  describe('request with auth header', () => {
    it('should include Bearer token when available', async () => {
      const { api, setToken } = await import('../api')
      setToken('my-jwt')
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'ok' }),
      })
      await api.get('/api/test')
      const call = mockFetch.mock.calls[0]
      expect(call[1].headers['Authorization']).toBe('Bearer my-jwt')
    })

    it('should handle HTTP errors', async () => {
      const { api } = await import('../api')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ detail: 'Not found' }),
      })
      await expect(api.get('/api/test')).rejects.toThrow('Not found')
    })

    it('should handle network failures with retry', async () => {
      const { api, setToken } = await import('../api')
      setToken('tok')
      mockFetch
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
      const result = await api.get('/api/test')
      expect(result).toEqual({ success: true })
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should NOT retry on 4xx errors', async () => {
      const { api, setToken } = await import('../api')
      setToken('tok')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Bad request' }),
      })
      await expect(api.get('/api/test')).rejects.toThrow('Bad request')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('request timeout', () => {
    it('should timeout after specified duration', async () => {
      const { api, setToken } = await import('../api')
      setToken('tok')
      mockFetch.mockImplementation(() => new Promise(() => {})) // never resolves
      await expect(
        api.get('/api/test', { timeout: 10 })
      ).rejects.toThrow(/timed out/)
    }, 5000)
  })

  describe('request cancellation', () => {
    it('should abort when signal is aborted', async () => {
      const { api, setToken } = await import('../api')
      setToken('tok')
      const controller = new AbortController()
      mockFetch.mockImplementation(async ({ signal }) => {
        return new Promise((resolve) => {
          signal?.addEventListener('abort', () => {
            const err = new Error('Aborted')
            err.name = 'AbortError'
            throw err
          })
        })
      })
      setTimeout(() => controller.abort(), 5)
      await expect(
        api.get('/api/test', { signal: controller.signal })
      ).rejects.toThrow(/cancelled/)
    }, 5000)
  })
})

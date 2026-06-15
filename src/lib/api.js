/**
 * Small fetch wrapper for the Primal API.
 * Set VITE_API_URL in .env.local (defaults to http://localhost:8080 for dev).
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
const DEFAULT_TIMEOUT_MS = 20000

async function request(method, path, body, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  // Abort the request if the network stalls — without this a hung mobile
  // connection leaves the checkout button stuck on "Processing…" forever.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error('The connection is slow right now. Please check your network and try again.')
      e.code = 'TIMEOUT'
      throw e
    }
    const e = new Error('Couldn’t reach our server. Please check your connection and try again.')
    e.code = 'NETWORK'
    throw e
  } finally {
    clearTimeout(timer)
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`)
    err.status = res.status
    err.payload = data
    throw err
  }
  return data
}

export const api = {
  get: (path, opts) => request('GET', path, undefined, opts),
  post: (path, body, opts) => request('POST', path, body, opts),
}

export const API_BASE_URL = API_URL

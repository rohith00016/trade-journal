import type { ApiResponse } from '@/types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function getToken() {
  return localStorage.getItem('tj_token')
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('tj_token', token)
  else localStorage.removeItem('tj_token')
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers)
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  if (!headers.has('Content-Type') && options.body && !isFormData) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null

  if (!res.ok || !json?.success) {
    throw new ApiError(json?.message || 'Request failed', res.status)
  }

  return json.data
}

export async function uploadScreenshot(file: File) {
  const body = new FormData()
  body.append('screenshot', file)
  return api<{ url: string; publicId: string }>('/uploads/screenshot', {
    method: 'POST',
    body,
  })
}

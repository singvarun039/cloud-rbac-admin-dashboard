import axios from 'axios'
import { clearAccessToken, getAccessToken } from '../auth/token'

const baseURL = import.meta.env.VITE_API_BASE_URL

if (!baseURL) {
  // Useful for local dev: if you don't set VITE_API_BASE_URL, axios will use same-origin.
  // This keeps the app running but makes misconfig easy to spot.
  console.warn('[api] VITE_API_BASE_URL is not set; using same-origin requests')
}

export const api = axios.create({
  baseURL: baseURL || undefined,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      clearAccessToken()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

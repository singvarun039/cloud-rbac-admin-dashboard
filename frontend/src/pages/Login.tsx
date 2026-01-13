import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as authApi from '../api/auth'
import { isAuthed, setAccessToken } from '../auth/token'
import { unwrapData } from '../types/api'
import type { LoginData, LoginResponse } from '../types/auth'

function extractAccessToken(res: LoginResponse): string | null {
  const unwrapped = unwrapData<LoginData>(res)
  const candidate = (unwrapped ?? res) as any

  const direct =
    candidate?.accessToken ??
    candidate?.token ??
    candidate?.data?.accessToken ??
    candidate?.data?.token

  return typeof direct === 'string' && direct.length > 0 ? direct : null
}

function extractErrorMessage(err: unknown): string {
  const anyErr = err as any
  return (
    anyErr?.response?.data?.message ||
    anyErr?.response?.data?.error ||
    anyErr?.message ||
    'Login failed.'
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const redirectTo = useMemo(() => {
    const state = location.state as any
    return typeof state?.from === 'string' ? state.from : '/'
  }, [location.state])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Acceptance: visiting /login while logged in redirects to /
    if (isAuthed()) {
      navigate('/', { replace: true })
    }
  }, [navigate])

  const emailValid = email.trim().length > 0 && email.includes('@')
  const passwordValid = password.length > 0

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!emailValid || !passwordValid) {
      setError('Email and password are required.')
      return
    }

    setLoading(true)
    try {
      const res = await authApi.login({ email: email.trim(), password })
      const token = extractAccessToken(res)

      if (!token) {
        throw new Error('Login succeeded but no access token was returned.')
      }

      setAccessToken(token)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-title">Sign in</div>
        <div className="muted">Cloud-Ready RBAC Admin Dashboard</div>

        {error ? <div className="alert">{error}</div> : null}

        <form onSubmit={onSubmit} className="form">
          <label className="label">
            Email
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>

          <label className="label">
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </label>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

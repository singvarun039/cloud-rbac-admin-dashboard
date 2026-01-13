import { useEffect, useState } from 'react'
import * as authApi from '../api/auth'
import type { MeUser } from '../types/user'
import { unwrapData } from '../types/api'

export default function DashboardPage() {
  const [me, setMe] = useState<MeUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError(null)
      try {
        const res = await authApi.me()
        const user = (unwrapData<MeUser>(res) ?? (res as MeUser)) || null

        if (!cancelled) {
          setMe(user)
        }

        // Day 11 proof that the token works.
        console.log('[auth/me]', user)
      } catch (e) {
        if (!cancelled) {
          setError('Failed to load profile.')
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>
      <p className="muted">
        Day 11: basic app shell + auth + /auth/me proof
      </p>

      {error ? <div className="alert">{error}</div> : null}

      <div className="card">
        <div className="card-title">Signed in user</div>
        <div className="kv">
          <div className="kv-row">
            <div className="kv-key">Name</div>
            <div className="kv-val">{me?.name ?? '—'}</div>
          </div>
          <div className="kv-row">
            <div className="kv-key">Email</div>
            <div className="kv-val">{me?.email ?? '—'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

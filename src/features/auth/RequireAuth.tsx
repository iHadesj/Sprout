// Portão das telas logadas: sem login, manda pra /entrar (e lembra pra onde ia).
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from './authContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  return children
}

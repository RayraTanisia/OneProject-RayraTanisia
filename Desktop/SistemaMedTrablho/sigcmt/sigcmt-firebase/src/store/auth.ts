import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile } from '../types'

interface AuthState {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: UserProfile | null) => void
  setLoading: (v: boolean) => void
  logout: () => void
  hasPermission: (perm: string) => boolean
  isRole: (...roles: string[]) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, isAuthenticated: false }),
      hasPermission: (perm) => {
        const { user } = get()
        if (!user) return false
        return user.role === 'ADMIN' || user.permissions.includes('*') || user.permissions.includes(perm)
      },
      isRole: (...roles) => {
        const { user } = get()
        if (!user) return false
        return user.role === 'ADMIN' || roles.includes(user.role)
      },
    }),
    { name: 'sigcmt-auth', partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }) }
  )
)

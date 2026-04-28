import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserInfo {
  id: string
  email: string
  fullName: string
  role: string
  permissions: string[]
  photoUrl?: string
  tenant: { id: string; name: string; slug: string }
}

interface AuthState {
  user: UserInfo | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: UserInfo, accessToken: string, refreshToken: string) => void
  setAccessToken: (token: string) => void
  logout: () => void
  hasPermission: (perm: string) => boolean
  isRole: (...roles: string[]) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      setAccessToken: (token) => set({ accessToken: token }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
      hasPermission: (perm) => {
        const { user } = get()
        if (!user) return false
        return user.permissions.includes('*') || user.permissions.includes(perm) || user.role === 'ADMIN'
      },
      isRole: (...roles) => {
        const { user } = get()
        if (!user) return false
        return user.role === 'ADMIN' || roles.includes(user.role)
      },
    }),
    { name: 'sigcmt-auth' }
  )
)

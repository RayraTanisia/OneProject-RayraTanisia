import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, type User
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { UserProfile } from '../types'

export const authService = {
  // Login
  async login(email: string, password: string): Promise<UserProfile> {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const profile = await this.getProfile(cred.user.uid)
    if (!profile) throw new Error('Perfil de usuário não encontrado.')
    if (!profile.active) throw new Error('Usuário inativo. Contate o administrador.')
    return profile
  },

  // Logout
  async logout(): Promise<void> {
    await signOut(auth)
  },

  // Buscar perfil do Firestore
  async getProfile(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(db, 'users', uid))
    if (!snap.exists()) return null
    const d = snap.data()
    return {
      uid,
      email: d.email,
      fullName: d.fullName,
      role: d.role,
      permissions: d.permissions || [],
      crmNumber: d.crmNumber,
      crmState: d.crmState,
      phone: d.phone,
      photoUrl: d.photoUrl,
      active: d.active ?? true,
      createdAt: d.createdAt?.toDate?.()?.toISOString() || '',
      updatedAt: d.updatedAt?.toDate?.()?.toISOString() || '',
    }
  },

  // Criar usuário (admin cria outros usuários)
  async createUser(email: string, password: string, profile: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await setDoc(doc(db, 'users', cred.user.uid), {
      ...profile,
      email,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return cred.user.uid
  },

  // Observer de estado de autenticação
  onAuthChange(cb: (user: User | null) => void) {
    return onAuthStateChanged(auth, cb)
  },
}

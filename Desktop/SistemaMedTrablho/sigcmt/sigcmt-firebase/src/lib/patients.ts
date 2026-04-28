import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, Timestamp,
  serverTimestamp, QueryDocumentSnapshot, writeBatch
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Patient } from '../types'

const COL = 'patients'

function toPatient(snap: QueryDocumentSnapshot): Patient {
  const d = snap.data()
  return {
    id: snap.id,
    fullName: d.fullName,
    cpf: d.cpf,
    rg: d.rg,
    birthDate: d.birthDate,
    gender: d.gender,
    bloodType: d.bloodType,
    phone: d.phone,
    email: d.email,
    whatsapp: d.whatsapp,
    address: d.address,
    currentCompanyId: d.currentCompanyId,
    currentCompanyName: d.currentCompanyName,
    currentJobTitle: d.currentJobTitle,
    occupationalRisks: d.occupationalRisks || [],
    allergies: d.allergies || [],
    continuousMedications: d.continuousMedications || [],
    medicalRestrictions: d.medicalRestrictions,
    familyHistory: d.familyHistory || [],
    heightCm: d.heightCm,
    weightKg: d.weightKg,
    photoUrl: d.photoUrl,
    status: d.status || 'ACTIVE',
    lgpdConsent: d.lgpdConsent || false,
    lgpdConsentDate: d.lgpdConsentDate,
    createdBy: d.createdBy,
    createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt,
    updatedAt: d.updatedAt?.toDate?.()?.toISOString() || d.updatedAt,
  }
}

export const patientService = {
  // Listar todos com busca simples por nome
  async list(searchName?: string): Promise<Patient[]> {
    let q = query(collection(db, COL), where('status', '!=', 'DELETED'), orderBy('status'), orderBy('fullName'))
    const snap = await getDocs(q)
    let patients = snap.docs.map(toPatient)
    if (searchName) {
      const lower = searchName.toLowerCase()
      patients = patients.filter(p =>
        p.fullName.toLowerCase().includes(lower) ||
        p.cpf?.includes(searchName.replace(/\D/g, '')) ||
        p.currentJobTitle?.toLowerCase().includes(lower)
      )
    }
    return patients
  },

  // Buscar por ID
  async getById(id: string): Promise<Patient | null> {
    const snap = await getDoc(doc(db, COL, id))
    if (!snap.exists()) return null
    return toPatient(snap as QueryDocumentSnapshot)
  },

  // Criar
  async create(data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ref = await addDoc(collection(db, COL), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  },

  // Atualizar
  async update(id: string, data: Partial<Patient>): Promise<void> {
    const { id: _, createdAt, ...rest } = data as any
    await updateDoc(doc(db, COL, id), { ...rest, updatedAt: serverTimestamp() })
  },

  // Soft-delete
  async delete(id: string): Promise<void> {
    await updateDoc(doc(db, COL, id), { status: 'INACTIVE', updatedAt: serverTimestamp() })
  },

  // Histórico de agendamentos do paciente
  async getAppointments(patientId: string) {
    const q = query(
      collection(db, 'appointments'),
      where('patientId', '==', patientId),
      orderBy('scheduledAt', 'desc'),
      limit(20)
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  },
}

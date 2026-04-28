// ── Usuários / Auth ────────────────────────────────────────────────────────────
export type UserRole =
  | 'ADMIN' | 'MANAGER' | 'DOCTOR' | 'NURSE'
  | 'RECEPTIONIST' | 'BILLING' | 'WAREHOUSE' | 'HR'

export interface UserProfile {
  uid: string
  email: string
  fullName: string
  role: UserRole
  permissions: string[]
  crmNumber?: string
  crmState?: string
  phone?: string
  photoUrl?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

// ── Pacientes ──────────────────────────────────────────────────────────────────
export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'DECEASED'
export type Gender = 'male' | 'female' | 'other' | 'prefer_not'
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'

export interface Address {
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zip?: string
}

export interface Allergy {
  substance: string
  reaction?: string
  severity?: 'mild' | 'moderate' | 'severe'
}

export interface Medication {
  name: string
  dosage?: string
  frequency?: string
}

export interface OccupationalRisk {
  code: string
  description: string
  level?: 'low' | 'medium' | 'high'
}

export interface Patient {
  id: string
  fullName: string
  cpf: string                // armazenado em texto para MVP (criptografar em produção)
  rg?: string
  birthDate?: string         // ISO date string
  gender?: Gender
  bloodType?: BloodType
  phone?: string
  email?: string
  whatsapp?: string
  address?: Address
  currentCompanyId?: string
  currentCompanyName?: string
  currentJobTitle?: string
  occupationalRisks: OccupationalRisk[]
  allergies: Allergy[]
  continuousMedications: Medication[]
  medicalRestrictions?: string
  familyHistory?: { condition: string; relation: string }[]
  heightCm?: number
  weightKg?: number
  photoUrl?: string
  status: PatientStatus
  lgpdConsent: boolean
  lgpdConsentDate?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ── Agendamentos ───────────────────────────────────────────────────────────────
export type AppointmentType =
  | 'INITIAL' | 'PERIODIC' | 'DISMISSAL'
  | 'ASO' | 'FOLLOWUP' | 'RETURN'

export type AppointmentStatus =
  | 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS'
  | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  doctorId: string
  doctorName: string
  roomId?: string
  roomName?: string
  companyId?: string
  companyName?: string
  appointmentType: AppointmentType
  scheduledAt: string        // ISO datetime string
  durationMinutes: number
  status: AppointmentStatus
  confirmedAt?: string
  checkedInAt?: string
  startedAt?: string
  endedAt?: string
  cancellationReason?: string
  cancelledBy?: string
  bookingChannel: string
  notes?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ── Salas ──────────────────────────────────────────────────────────────────────
export interface Room {
  id: string
  name: string
  equipment: string[]
  active: boolean
}

// ── Médico / Agenda ────────────────────────────────────────────────────────────
export interface DoctorSchedule {
  doctorId: string
  dayOfWeek: number          // 0=Dom … 6=Sab
  startTime: string          // "08:00"
  endTime: string            // "18:00"
  slotDurationMin: number
  breakStart?: string
  breakEnd?: string
  maxAppointments?: number
  active: boolean
}

// ── Empresas ───────────────────────────────────────────────────────────────────
export interface Company {
  id: string
  cnpj: string
  legalName: string
  tradeName?: string
  cnae?: string
  riskLevel?: 1 | 2 | 3 | 4
  sector?: string
  employeeCount?: number
  phone?: string
  email?: string
  status: 'ACTIVE' | 'INACTIVE' | 'PROSPECT'
  createdAt: string
  updatedAt: string
}

// ── Helpers de UI ──────────────────────────────────────────────────────────────
export const APPOINTMENT_TYPE_LABEL: Record<AppointmentType, string> = {
  INITIAL: 'Consulta Inicial',
  PERIODIC: 'Periódico',
  DISMISSAL: 'Demissional',
  ASO: 'ASO',
  FOLLOWUP: 'Acompanhamento',
  RETURN: 'Retorno',
}

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Faltou',
}

export const APPOINTMENT_STATUS_COLOR: Record<AppointmentStatus, string> = {
  SCHEDULED:   'bg-blue-50 text-blue-700',
  CONFIRMED:   'bg-green-50 text-green-700',
  IN_PROGRESS: 'bg-yellow-50 text-yellow-700',
  COMPLETED:   'bg-gray-100 text-gray-600',
  CANCELLED:   'bg-red-50 text-red-600',
  NO_SHOW:     'bg-orange-50 text-orange-700',
}

export const APPOINTMENT_STATUS_DOT: Record<AppointmentStatus, string> = {
  SCHEDULED:   'bg-blue-500',
  CONFIRMED:   'bg-green-500',
  IN_PROGRESS: 'bg-yellow-500',
  COMPLETED:   'bg-gray-400',
  CANCELLED:   'bg-red-400',
  NO_SHOW:     'bg-orange-400',
}

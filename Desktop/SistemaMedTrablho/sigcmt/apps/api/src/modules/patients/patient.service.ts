import { prisma } from '@sigcmt/database'
import { z } from 'zod'
import { encrypt, hashForSearch, safeDecrypt } from '../../shared/utils/crypto'

export const createPatientSchema = z.object({
  fullName: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos numéricos'),
  rg: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not']).optional(),
  bloodType: z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    number: z.string().optional(),
    complement: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
  currentCompanyId: z.string().uuid().optional(),
  currentJobTitle: z.string().optional(),
  occupationalRisks: z.array(z.object({
    code: z.string(),
    description: z.string(),
    level: z.string().optional(),
  })).optional(),
  allergies: z.array(z.object({
    substance: z.string(),
    reaction: z.string().optional(),
    severity: z.string().optional(),
  })).optional(),
  continuousMedications: z.array(z.object({
    name: z.string(),
    dosage: z.string().optional(),
    frequency: z.string().optional(),
  })).optional(),
  medicalRestrictions: z.string().optional(),
  familyHistory: z.array(z.object({
    condition: z.string(),
    relation: z.string(),
  })).optional(),
  heightCm: z.number().positive().optional(),
  weightKg: z.number().positive().optional(),
  lgpdConsent: z.object({
    consented: z.boolean(),
    channels: z.array(z.string()).optional(),
  }).optional(),
  customFields: z.record(z.unknown()).optional(),
})

export const updatePatientSchema = createPatientSchema.partial()

export const listPatientSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  cpf: z.string().optional(),
  companyId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE','INACTIVE','DECEASED']).optional(),
  setor: z.string().optional(),
})

// Formatar dado do banco para retorno (decriptar campos sensíveis)
function formatPatient(patient: Record<string, unknown>, includeContact = true) {
  const formatted: Record<string, unknown> = {
    id: patient.id,
    fullName: patient.fullName,
    rg: patient.rg,
    birthDate: patient.birthDate,
    gender: patient.gender,
    bloodType: patient.bloodType,
    address: patient.address,
    currentJobTitle: patient.currentJobTitle,
    occupationalRisks: patient.occupationalRisks,
    allergies: patient.allergies,
    continuousMedications: patient.continuousMedications,
    medicalRestrictions: patient.medicalRestrictions,
    familyHistory: patient.familyHistory,
    heightCm: patient.heightCm,
    weightKg: patient.weightKg,
    photoUrl: patient.photoUrl,
    status: patient.status,
    esocialId: patient.esocialId,
    customFields: patient.customFields,
    lgpdConsent: patient.lgpdConsent,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  }

  if (includeContact) {
    formatted.phone = safeDecrypt(patient.phoneEncrypted as string)
    formatted.email = safeDecrypt(patient.emailEncrypted as string)
    formatted.whatsapp = safeDecrypt(patient.whatsappEncrypted as string)
  }

  return formatted
}

export class PatientService {
  async list(tenantId: string, query: z.infer<typeof listPatientSchema>) {
    const { page, limit, search, cpf, companyId, status, setor } = query
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { tenantId, deletedAt: null }
    if (status) where.status = status
    if (companyId) where.currentCompanyId = companyId
    if (search) where.fullName = { contains: search, mode: 'insensitive' }
    if (cpf) where.cpfHash = hashForSearch(cpf.replace(/\D/g, ''), tenantId)
    if (setor) where.customFields = { path: ['setor'], equals: setor }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fullName: 'asc' },
        include: {
          company: { select: { id: true, tradeName: true, legalName: true } },
        },
      }),
      prisma.patient.count({ where }),
    ])

    return {
      data: patients.map(p => ({ ...formatPatient(p as Record<string, unknown>, false), company: p.company })),
      total,
      page,
      limit,
    }
  }

  async findById(id: string, tenantId: string) {
    const patient = await prisma.patient.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        company: { select: { id: true, tradeName: true, legalName: true, cnae: true, riskLevel: true } },
        documents: { select: { id: true, type: true, fileName: true, fileUrl: true, uploadedAt: true } },
        appointments: {
          take: 10,
          orderBy: { scheduledAt: 'desc' },
          select: { id: true, scheduledAt: true, appointmentType: true, status: true, doctor: { select: { fullName: true } } },
        },
      },
    })
    if (!patient) throw { statusCode: 404, message: 'Paciente não encontrado.' }
    return { ...formatPatient(patient as Record<string, unknown>), company: patient.company, documents: patient.documents, recentAppointments: patient.appointments }
  }

  async create(tenantId: string, userId: string, data: z.infer<typeof createPatientSchema>) {
    const cpfClean = data.cpf.replace(/\D/g, '')
    const cpfHash = hashForSearch(cpfClean, tenantId)

    const existing = await prisma.patient.findUnique({ where: { tenantId_cpfHash: { tenantId, cpfHash } } })
    if (existing) throw { statusCode: 409, message: 'Já existe um paciente cadastrado com este CPF.' }

    const patient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: data.fullName,
        cpfEncrypted: encrypt(cpfClean),
        cpfHash,
        rg: data.rg,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        gender: data.gender,
        bloodType: data.bloodType,
        phoneEncrypted: data.phone ? encrypt(data.phone.replace(/\D/g, '')) : undefined,
        emailEncrypted: data.email ? encrypt(data.email) : undefined,
        whatsappEncrypted: data.whatsapp ? encrypt(data.whatsapp.replace(/\D/g, '')) : undefined,
        address: data.address,
        currentCompanyId: data.currentCompanyId,
        currentJobTitle: data.currentJobTitle,
        occupationalRisks: data.occupationalRisks || [],
        allergies: data.allergies || [],
        continuousMedications: data.continuousMedications || [],
        medicalRestrictions: data.medicalRestrictions,
        familyHistory: data.familyHistory || [],
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        lgpdConsent: data.lgpdConsent
          ? { ...data.lgpdConsent, date: new Date().toISOString(), version: '1.0' }
          : undefined,
        customFields: (data.customFields || {}) as any,
        createdById: userId,
      },
    })

    return formatPatient(patient as Record<string, unknown>)
  }

  async update(id: string, tenantId: string, data: z.infer<typeof updatePatientSchema>) {
    const existing = await prisma.patient.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw { statusCode: 404, message: 'Paciente não encontrado.' }

    const updateData: Record<string, unknown> = {}

    if (data.fullName) updateData.fullName = data.fullName
    if (data.rg !== undefined) updateData.rg = data.rg
    if (data.birthDate) updateData.birthDate = new Date(data.birthDate)
    if (data.gender) updateData.gender = data.gender
    if (data.bloodType) updateData.bloodType = data.bloodType
    if (data.phone) updateData.phoneEncrypted = encrypt(data.phone.replace(/\D/g, ''))
    if (data.email) updateData.emailEncrypted = encrypt(data.email)
    if (data.whatsapp) updateData.whatsappEncrypted = encrypt(data.whatsapp.replace(/\D/g, ''))
    if (data.address) updateData.address = data.address
    if (data.currentCompanyId !== undefined) updateData.currentCompanyId = data.currentCompanyId
    if (data.currentJobTitle !== undefined) updateData.currentJobTitle = data.currentJobTitle
    if (data.occupationalRisks) updateData.occupationalRisks = data.occupationalRisks
    if (data.allergies) updateData.allergies = data.allergies
    if (data.continuousMedications) updateData.continuousMedications = data.continuousMedications
    if (data.medicalRestrictions !== undefined) updateData.medicalRestrictions = data.medicalRestrictions
    if (data.familyHistory) updateData.familyHistory = data.familyHistory
    if (data.heightCm) updateData.heightCm = data.heightCm
    if (data.weightKg) updateData.weightKg = data.weightKg
    if (data.customFields) updateData.customFields = { ...(existing.customFields as Record<string, unknown> ?? {}), ...data.customFields } as any

    const patient = await prisma.patient.update({ where: { id }, data: updateData })
    return formatPatient(patient as Record<string, unknown>)
  }

  async delete(id: string, tenantId: string) {
    const existing = await prisma.patient.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw { statusCode: 404, message: 'Paciente não encontrado.' }
    await prisma.patient.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } })
  }
}

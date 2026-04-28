import { prisma } from '@sigcmt/database'
import { z } from 'zod'

export const createAsoSchema = z.object({
  patientId: z.string().uuid(),
  companyId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  examType: z.enum(['ADMISSIONAL','PERIODICO','RETORNO_TRABALHO','MUDANCA_FUNCAO','DEMISSIONAL']),
  conclusion: z.enum(['APTO','INAPTO','APTO_RESTRICOES']),
  restrictions: z.string().optional(),
  complementaryExams: z.array(z.object({
    name: z.string(),
    result: z.string().optional(),
    date: z.string().optional(),
  })).default([]),
  riskFactors: z.array(z.object({
    code: z.string(),
    description: z.string(),
    level: z.string().optional(),
  })).default([]),
  validUntil: z.string().optional(),
  observations: z.string().optional(),
  issuedAt: z.string().optional(),
})

export const listAsoSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  patientId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  examType: z.string().optional(),
})

export class AsoService {
  async list(tenantId: string, query: z.infer<typeof listAsoSchema>) {
    const { page, limit, patientId, companyId, examType } = query
    const skip = (page - 1) * limit
    const where: Record<string, unknown> = { tenantId }
    if (patientId) where.patientId = patientId
    if (companyId) where.companyId = companyId
    if (examType) where.examType = examType

    const [asos, total] = await Promise.all([
      prisma.aso.findMany({
        where, skip, take: limit, orderBy: { issuedAt: 'desc' },
        include: {
          patient: { select: { id: true, fullName: true, currentJobTitle: true } },
          company: { select: { id: true, tradeName: true, legalName: true } },
          doctor: { select: { id: true, fullName: true, crmNumber: true, crmState: true } },
        },
      }),
      prisma.aso.count({ where }),
    ])

    return { data: asos, total, page, limit }
  }

  async findById(id: string, tenantId: string) {
    const aso = await prisma.aso.findFirst({
      where: { id, tenantId },
      include: {
        patient: {
          select: {
            id: true, fullName: true, birthDate: true, gender: true,
            currentJobTitle: true, bloodType: true, rg: true,
          },
        },
        company: { select: { id: true, tradeName: true, legalName: true, cnpj: true, cnae: true, riskLevel: true } },
        doctor: { select: { id: true, fullName: true, crmNumber: true, crmState: true } },
        tenant: { select: { id: true, name: true, address: true, phone: true } },
      },
    })
    if (!aso) throw { statusCode: 404, message: 'ASO não encontrado.' }
    return aso
  }

  async create(tenantId: string, doctorId: string, data: z.infer<typeof createAsoSchema>) {
    const patient = await prisma.patient.findFirst({ where: { id: data.patientId, tenantId, deletedAt: null } })
    if (!patient) throw { statusCode: 404, message: 'Paciente não encontrado.' }

    return prisma.aso.create({
      data: {
        tenantId,
        doctorId,
        patientId: data.patientId,
        companyId: data.companyId || patient.currentCompanyId || undefined,
        appointmentId: data.appointmentId,
        examType: data.examType,
        conclusion: data.conclusion,
        restrictions: data.restrictions,
        complementaryExams: data.complementaryExams,
        riskFactors: data.riskFactors,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        observations: data.observations,
        issuedAt: data.issuedAt ? new Date(data.issuedAt) : new Date(),
      },
      include: {
        patient: { select: { id: true, fullName: true, currentJobTitle: true } },
        company: { select: { id: true, tradeName: true, legalName: true } },
        doctor: { select: { id: true, fullName: true, crmNumber: true, crmState: true } },
      },
    })
  }

  async delete(id: string, tenantId: string) {
    const existing = await prisma.aso.findFirst({ where: { id, tenantId } })
    if (!existing) throw { statusCode: 404, message: 'ASO não encontrado.' }
    await prisma.aso.delete({ where: { id } })
  }
}

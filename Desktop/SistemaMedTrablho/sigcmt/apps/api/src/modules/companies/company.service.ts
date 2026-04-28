import { prisma } from '@sigcmt/database'
import { z } from 'zod'
import { createHash } from 'crypto'

function hashCnpj(cnpj: string, tenantId: string): string {
  return createHash('sha256').update(cnpj + tenantId).digest('hex')
}

export const createCompanySchema = z.object({
  cnpj: z.string().min(11, 'CNPJ inválido'),
  legalName: z.string().min(3, 'Razão social obrigatória'),
  tradeName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  cnae: z.string().optional(),
  riskLevel: z.coerce.number().int().min(1).max(4).default(1),
  sector: z.string().optional(),
  employeeCount: z.coerce.number().int().positive().optional(),
  address: z.object({
    street: z.string().optional(),
    number: z.string().optional(),
    complement: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).passthrough().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT']).default('ACTIVE'),
})

export const updateCompanySchema = createCompanySchema.omit({ cnpj: true }).partial()

export const listCompanySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT']).optional(),
})

export class CompanyService {
  async list(tenantId: string, query: z.infer<typeof listCompanySchema>) {
    const { page, limit, search, status } = query
    const skip = (page - 1) * limit
    const where: Record<string, unknown> = { tenantId }
    if (status) where.status = status
    if (search) {
      where.OR = [
        { legalName: { contains: search, mode: 'insensitive' } },
        { tradeName: { contains: search, mode: 'insensitive' } },
        { cnpj: { contains: search.replace(/\D/g, '') } },
      ]
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where, skip, take: limit, orderBy: { legalName: 'asc' },
        include: { _count: { select: { patients: true, appointments: true } } },
      }),
      prisma.company.count({ where }),
    ])

    return { data: companies, total, page, limit }
  }

  async findById(id: string, tenantId: string) {
    const company = await prisma.company.findFirst({
      where: { id, tenantId },
      include: {
        patients: {
          where: { deletedAt: null },
          take: 30,
          select: { id: true, fullName: true, currentJobTitle: true, status: true, birthDate: true },
          orderBy: { fullName: 'asc' },
        },
        appointments: {
          take: 10,
          orderBy: { scheduledAt: 'desc' },
          select: {
            id: true, scheduledAt: true, appointmentType: true, status: true,
            patient: { select: { fullName: true } },
            doctor: { select: { fullName: true } },
          },
        },
        _count: { select: { patients: true, appointments: true } },
      },
    })
    if (!company) throw { statusCode: 404, message: 'Empresa não encontrada.' }
    return company
  }

  async create(tenantId: string, data: z.infer<typeof createCompanySchema>) {
    const cnpjClean = data.cnpj.replace(/\D/g, '')
    const cnpjHash = hashCnpj(cnpjClean, tenantId)

    const existing = await prisma.company.findUnique({ where: { tenantId_cnpjHash: { tenantId, cnpjHash } } })
    if (existing) throw { statusCode: 409, message: 'Já existe uma empresa cadastrada com este CNPJ.' }

    return prisma.company.create({
      data: {
        tenantId,
        cnpj: cnpjClean,
        cnpjHash,
        legalName: data.legalName,
        tradeName: data.tradeName,
        phone: data.phone,
        email: data.email || undefined,
        cnae: data.cnae,
        riskLevel: data.riskLevel,
        sector: data.sector,
        employeeCount: data.employeeCount,
        address: data.address,
        status: data.status,
      },
    })
  }

  async update(id: string, tenantId: string, data: z.infer<typeof updateCompanySchema>) {
    const existing = await prisma.company.findFirst({ where: { id, tenantId } })
    if (!existing) throw { statusCode: 404, message: 'Empresa não encontrada.' }

    return prisma.company.update({
      where: { id },
      data: {
        legalName: data.legalName,
        tradeName: data.tradeName,
        phone: data.phone,
        email: data.email || undefined,
        cnae: data.cnae,
        riskLevel: data.riskLevel,
        sector: data.sector,
        employeeCount: data.employeeCount,
        address: data.address,
        status: data.status,
      },
    })
  }

  async delete(id: string, tenantId: string) {
    const existing = await prisma.company.findFirst({ where: { id, tenantId } })
    if (!existing) throw { statusCode: 404, message: 'Empresa não encontrada.' }
    await prisma.company.update({ where: { id }, data: { status: 'INACTIVE' } })
  }
}

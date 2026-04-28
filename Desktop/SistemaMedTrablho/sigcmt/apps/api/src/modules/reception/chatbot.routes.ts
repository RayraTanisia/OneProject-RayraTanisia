import type { FastifyInstance } from 'fastify'
import { prisma } from '@sigcmt/database'
import { z } from 'zod'
import { ok } from '../../shared/plugins/errorHandler'
import { encrypt, hashForSearch } from '../../shared/utils/crypto'
import { createHash } from 'crypto'

function hashCnpj(cnpj: string, tenantId: string): string {
  return createHash('sha256').update(cnpj + tenantId).digest('hex')
}

const registerPatientSchema = z.object({
  fullName: z.string().min(3),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
  customFields: z.record(z.unknown()).optional(),
  lgpdConsent: z.object({
    consented: z.boolean(),
    channels: z.array(z.string()).optional(),
  }).optional(),
})

const registerCompanySchema = z.object({
  cnpj: z.string().min(14).max(14),
  legalName: z.string().min(3),
  tradeName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
})

export async function chatbotRoutes(fastify: FastifyInstance) {
  // Busca o tenant padrão (única clínica)
  async function getDefaultTenant() {
    const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } })
    if (!tenant) throw { statusCode: 503, message: 'Clínica não configurada.' }
    return tenant
  }

  // POST /api/v1/public/chatbot/patient
  fastify.post('/patient', async (request, reply) => {
    const body = registerPatientSchema.parse(request.body)
    const tenant = await getDefaultTenant()
    const tenantId = tenant.id

    const cpfClean = body.cpf.replace(/\D/g, '')
    const cpfHash = hashForSearch(cpfClean, tenantId)

    const existing = await prisma.patient.findUnique({
      where: { tenantId_cpfHash: { tenantId, cpfHash } },
    })
    if (existing) {
      return reply.status(409).send({ success: false, error: { code: 'DUPLICATE', message: 'CPF já cadastrado.' } })
    }

    const patient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: body.fullName,
        cpfEncrypted: encrypt(cpfClean),
        cpfHash,
        lgpdConsent: body.lgpdConsent
          ? { ...body.lgpdConsent, date: new Date().toISOString(), version: '1.0' }
          : undefined,
        customFields: (body.customFields || {}) as any,
        occupationalRisks: [],
        allergies: [],
        continuousMedications: [],
        familyHistory: [],
      },
    })

    return reply.status(201).send(ok({ id: patient.id, fullName: patient.fullName }))
  })

  // POST /api/v1/public/chatbot/company
  fastify.post('/company', async (request, reply) => {
    const body = registerCompanySchema.parse(request.body)
    const tenant = await getDefaultTenant()
    const tenantId = tenant.id

    const cnpjClean = body.cnpj.replace(/\D/g, '')
    const cnpjHash = hashCnpj(cnpjClean, tenantId)

    const existing = await prisma.company.findUnique({
      where: { tenantId_cnpjHash: { tenantId, cnpjHash } },
    })
    if (existing) {
      return reply.status(409).send({ success: false, error: { code: 'DUPLICATE', message: 'CNPJ já cadastrado.' } })
    }

    const company = await prisma.company.create({
      data: {
        tenantId,
        cnpj: cnpjClean,
        cnpjHash,
        legalName: body.legalName,
        tradeName: body.tradeName,
        phone: body.phone,
        email: body.email || undefined,
        status: 'PROSPECT',
      },
    })

    return reply.status(201).send(ok({ id: company.id, legalName: company.legalName }))
  })
}

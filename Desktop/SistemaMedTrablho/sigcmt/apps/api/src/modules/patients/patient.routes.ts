import type { FastifyInstance } from 'fastify'
import { PatientService, createPatientSchema, updatePatientSchema, listPatientSchema } from './patient.service'
import { ok, paginated } from '../../shared/plugins/errorHandler'

const BUCKET = 'patient-documents'

async function uploadToStorage(buffer: Buffer, path: string, contentType: string) {
  const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': contentType,
    },
    body: new Uint8Array(buffer),
  })
  if (!res.ok) {
    const err = await res.text()
    throw { statusCode: 500, message: `Falha no upload: ${err}` }
  }
}

async function getSignedUrl(path: string): Promise<string> {
  const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: 3600 }),
  })
  if (!res.ok) return ''
  const data = await res.json() as { signedURL: string }
  return `${process.env.SUPABASE_URL}/storage/v1${data.signedURL}`
}

async function deleteFromStorage(path: string) {
  await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: [path] }),
  })
}

export async function patientRoutes(fastify: FastifyInstance) {
  const service = new PatientService()

  // GET /api/v1/patients
  fastify.get('/', async (request, reply) => {
    const query = listPatientSchema.parse(request.query)
    const result = await service.list(request.currentUser.tenantId, query)
    return reply.send(paginated(result.data, result.total, result.page, result.limit))
  })

  // GET /api/v1/patients/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const patient = await service.findById(id, request.currentUser.tenantId)
    return reply.send(ok(patient))
  })

  // POST /api/v1/patients
  fastify.post('/', async (request, reply) => {
    const body = createPatientSchema.parse(request.body)
    const patient = await service.create(request.currentUser.tenantId, request.currentUser.id, body)
    return reply.status(201).send(ok(patient))
  })

  // PUT /api/v1/patients/:id
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updatePatientSchema.parse(request.body)
    const patient = await service.update(id, request.currentUser.tenantId, body)
    return reply.send(ok(patient))
  })

  // DELETE /api/v1/patients/:id (soft-delete)
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await service.delete(id, request.currentUser.tenantId)
    return reply.send(ok({ message: 'Paciente removido com sucesso.' }))
  })

  // GET /api/v1/patients/export — exporta CSV
  fastify.get('/export', async (request, reply) => {
    const { prisma } = await import('@sigcmt/database')
    const { search, companyId } = request.query as { search?: string; companyId?: string }
    const where: Record<string, unknown> = { tenantId: request.currentUser.tenantId, deletedAt: null }
    if (search) where.fullName = { contains: search, mode: 'insensitive' }
    if (companyId) where.currentCompanyId = companyId

    const patients = await prisma.patient.findMany({
      where,
      include: { company: { select: { tradeName: true, legalName: true } } },
      orderBy: { fullName: 'asc' },
      take: 5000,
    })

    const rows = [
      ['Nome', 'Data Nasc.', 'Gênero', 'Empresa', 'Função', 'Status', 'Cadastro'],
      ...patients.map(p => [
        p.fullName,
        p.birthDate ? new Date(p.birthDate).toLocaleDateString('pt-BR') : '',
        p.gender || '',
        p.company?.tradeName || p.company?.legalName || '',
        p.currentJobTitle || '',
        p.status,
        new Date(p.createdAt).toLocaleDateString('pt-BR'),
      ]),
    ]

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="pacientes.csv"')
    return reply.send('﻿' + csv)
  })

  // GET /api/v1/patients/:id/history - histórico de consultas
  fastify.get('/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { prisma } = await import('@sigcmt/database')
    const appointments = await prisma.appointment.findMany({
      where: { patientId: id, tenantId: request.currentUser.tenantId },
      orderBy: { scheduledAt: 'desc' },
      include: {
        doctor: { select: { fullName: true, crmNumber: true } },
        room: { select: { name: true } },
      },
    })
    return reply.send(ok(appointments))
  })

  // GET /api/v1/patients/:id/documents
  fastify.get('/:id/documents', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { prisma } = await import('@sigcmt/database')
    const patient = await prisma.patient.findFirst({ where: { id, tenantId: request.currentUser.tenantId } })
    if (!patient) throw { statusCode: 404, message: 'Paciente não encontrado.' }

    const docs = await prisma.patientDocument.findMany({
      where: { patientId: id },
      orderBy: { uploadedAt: 'desc' },
    })

    const docsWithUrls = await Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        downloadUrl: doc.fileUrl ? await getSignedUrl(doc.fileUrl).catch(() => '') : '',
      }))
    )

    return reply.send(ok(docsWithUrls))
  })

  // POST /api/v1/patients/:id/documents
  fastify.post('/:id/documents', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { type: docType = 'OUTRO' } = request.query as { type?: string }
    const { prisma } = await import('@sigcmt/database')

    const patient = await prisma.patient.findFirst({ where: { id, tenantId: request.currentUser.tenantId } })
    if (!patient) throw { statusCode: 404, message: 'Paciente não encontrado.' }

    const data = await request.file()
    if (!data) throw { statusCode: 400, message: 'Nenhum arquivo enviado.' }

    const fileBuffer = await data.toBuffer()
    const safeName = (data.filename || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${request.currentUser.tenantId}/${id}/${Date.now()}-${safeName}`

    await uploadToStorage(fileBuffer, storagePath, data.mimetype)

    const doc = await prisma.patientDocument.create({
      data: {
        patientId: id,
        type: docType,
        fileUrl: storagePath,
        fileName: data.filename || safeName,
        fileSize: fileBuffer.length,
        uploadedBy: request.currentUser.id,
      },
    })

    return reply.status(201).send(ok({ ...doc, downloadUrl: await getSignedUrl(storagePath).catch(() => '') }))
  })

  // DELETE /api/v1/patients/:id/documents/:docId
  fastify.delete('/:id/documents/:docId', async (request, reply) => {
    const { id, docId } = request.params as { id: string; docId: string }
    const { prisma } = await import('@sigcmt/database')

    const doc = await prisma.patientDocument.findFirst({ where: { id: docId, patientId: id } })
    if (!doc) throw { statusCode: 404, message: 'Documento não encontrado.' }

    await deleteFromStorage(doc.fileUrl)
    await prisma.patientDocument.delete({ where: { id: docId } })

    return reply.send(ok({ message: 'Documento removido.' }))
  })
}

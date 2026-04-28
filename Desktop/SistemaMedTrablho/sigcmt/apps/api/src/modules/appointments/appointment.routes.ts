import type { FastifyInstance } from 'fastify'
import { AppointmentService, createAppointmentSchema, updateAppointmentSchema, listAppointmentsSchema } from './appointment.service'
import { ok, paginated } from '../../shared/plugins/errorHandler'
import { z } from 'zod'
import { sendAppointmentReminder, testConnection } from '../../shared/services/email.service'
import dayjs from 'dayjs'

export async function appointmentRoutes(fastify: FastifyInstance) {
  const service = new AppointmentService()

  fastify.get('/', async (request, reply) => {
    const query = listAppointmentsSchema.parse(request.query)
    const result = await service.list(request.currentUser.tenantId, query)
    return reply.send(paginated(result.data, result.total, result.page, result.limit))
  })

  fastify.get('/availability', async (request, reply) => {
    const { doctorId, date } = z.object({ doctorId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(request.query)
    const result = await service.getAvailableSlots(request.currentUser.tenantId, doctorId, date)
    return reply.send(ok(result))
  })

  fastify.get('/stats', async (request, reply) => {
    const stats = await service.getDashboardStats(request.currentUser.tenantId)
    return reply.send(ok(stats))
  })

  fastify.get('/rooms', async (request, reply) => {
    const { prisma } = await import('@sigcmt/database')
    const rooms = await prisma.room.findMany({ where: { tenantId: request.currentUser.tenantId, active: true }, orderBy: { name: 'asc' } })
    return reply.send(ok(rooms))
  })

  // GET /appointments/export — exporta CSV
  fastify.get('/export', async (request, reply) => {
    const { prisma } = await import('@sigcmt/database')
    const { startDate, endDate, doctorId, status } = request.query as Record<string, string>
    const where: Record<string, unknown> = { tenantId: request.currentUser.tenantId }
    if (startDate) where.scheduledAt = { gte: new Date(startDate) }
    if (endDate) where.scheduledAt = { ...(where.scheduledAt as object || {}), lte: new Date(endDate + 'T23:59:59') }
    if (doctorId) where.doctorId = doctorId
    if (status) where.status = status

    const apts = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { fullName: true } },
        doctor: { select: { fullName: true } },
        company: { select: { tradeName: true, legalName: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 5000,
    })

    const TYPE_LABELS: Record<string, string> = {
      INITIAL: 'Consulta Inicial', PERIODIC: 'Periódico', DISMISSAL: 'Demissional',
      ASO: 'ASO', FOLLOWUP: 'Acompanhamento', RETURN: 'Retorno',
    }
    const STATUS_LABELS: Record<string, string> = {
      SCHEDULED: 'Agendado', CONFIRMED: 'Confirmado', IN_PROGRESS: 'Em andamento',
      COMPLETED: 'Concluído', CANCELLED: 'Cancelado', NO_SHOW: 'Faltou',
    }

    const rows = [
      ['Data', 'Hora', 'Paciente', 'Médico', 'Empresa', 'Tipo', 'Status', 'Duração (min)'],
      ...apts.map(a => [
        new Date(a.scheduledAt).toLocaleDateString('pt-BR'),
        new Date(a.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        a.patient?.fullName || '',
        a.doctor?.fullName || '',
        a.company?.tradeName || a.company?.legalName || '',
        TYPE_LABELS[a.appointmentType] || a.appointmentType,
        STATUS_LABELS[a.status] || a.status,
        a.durationMinutes,
      ]),
    ]

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="agendamentos.csv"')
    return reply.send('﻿' + csv)
  })

  // GET /appointments/blocked-slots?doctorId=&startDate=&endDate=
  fastify.get('/blocked-slots', async (request, reply) => {
    const { prisma } = await import('@sigcmt/database')
    const { doctorId, startDate, endDate } = z.object({
      doctorId: z.string().uuid().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).parse(request.query)

    const where: Record<string, unknown> = { tenantId: request.currentUser.tenantId }
    if (doctorId) where.doctorId = doctorId
    if (startDate) where.startAt = { gte: new Date(startDate) }
    if (endDate) where.endAt = { lte: new Date(endDate + 'T23:59:59') }

    const slots = await prisma.blockedSlot.findMany({ where, orderBy: { startAt: 'asc' } })
    return reply.send(ok(slots))
  })

  // POST /appointments/blocked-slots
  fastify.post('/blocked-slots', async (request, reply) => {
    const { prisma } = await import('@sigcmt/database')
    const body = z.object({
      doctorId: z.string().uuid().optional(),
      roomId: z.string().uuid().optional(),
      startAt: z.string(),
      endAt: z.string(),
      reason: z.string().optional(),
    }).parse(request.body)

    const slot = await prisma.blockedSlot.create({
      data: {
        tenantId: request.currentUser.tenantId,
        doctorId: body.doctorId,
        roomId: body.roomId,
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        reason: body.reason,
        createdBy: request.currentUser.id,
      },
    })
    return reply.status(201).send(ok(slot))
  })

  // DELETE /appointments/blocked-slots/:slotId
  fastify.delete('/blocked-slots/:slotId', async (request, reply) => {
    const { prisma } = await import('@sigcmt/database')
    const { slotId } = request.params as { slotId: string }
    await prisma.blockedSlot.deleteMany({ where: { id: slotId, tenantId: request.currentUser.tenantId } })
    return reply.send(ok({ message: 'Bloqueio removido.' }))
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const appointment = await service.findById(id, request.currentUser.tenantId)
    return reply.send(ok(appointment))
  })

  fastify.post('/', async (request, reply) => {
    const body = createAppointmentSchema.parse(request.body)
    const appointment = await service.create(request.currentUser.tenantId, body)
    return reply.status(201).send(ok(appointment))
  })

  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updateAppointmentSchema.parse(request.body)
    const appointment = await service.update(id, request.currentUser.tenantId, body)
    return reply.send(ok(appointment))
  })

  fastify.post('/:id/confirm', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { channel } = (request.body as { channel?: string }) || {}
    const appointment = await service.confirm(id, request.currentUser.tenantId, channel)
    return reply.send(ok(appointment))
  })

  fastify.post('/:id/check-in', async (request, reply) => {
    const { id } = request.params as { id: string }
    const appointment = await service.checkIn(id, request.currentUser.tenantId)
    return reply.send(ok(appointment))
  })

  fastify.post('/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { reason } = z.object({ reason: z.string().min(3, 'Informe o motivo do cancelamento.') }).parse(request.body)
    const appointment = await service.cancel(id, request.currentUser.tenantId, reason, request.currentUser.id)
    return reply.send(ok(appointment))
  })

  // GET /appointments/test-email — testa conexão SMTP
  fastify.get('/test-email', async (_request, reply) => {
    const result = await testConnection()
    return reply.send(result)
  })

  // POST /appointments/:id/send-reminder — envia e-mail de lembrete manualmente
  fastify.post('/:id/send-reminder', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { prisma } = await import('@sigcmt/database')
    const apt = await prisma.appointment.findFirst({
      where: { id, tenantId: request.currentUser.tenantId },
      include: { patient: { select: { fullName: true, email: true } }, doctor: { select: { fullName: true } } },
    })
    if (!apt) throw { statusCode: 404, message: 'Agendamento não encontrado.' }
    if (!apt.patient?.email) throw { statusCode: 400, message: 'Paciente não possui e-mail cadastrado.' }

    const TYPE_LABELS: Record<string, string> = {
      INITIAL: 'Consulta Inicial', PERIODIC: 'Periódico', DISMISSAL: 'Demissional',
      ASO: 'ASO', FOLLOWUP: 'Acompanhamento', RETURN: 'Retorno',
    }
    await sendAppointmentReminder({
      to: apt.patient.email,
      patientName: apt.patient.fullName,
      doctorName: apt.doctor?.fullName ?? '',
      date: dayjs(apt.scheduledAt).format('DD/MM/YYYY'),
      time: dayjs(apt.scheduledAt).format('HH:mm'),
      type: TYPE_LABELS[apt.appointmentType] ?? apt.appointmentType,
    })
    return reply.send(ok({ message: 'Lembrete enviado com sucesso.' }))
  })

  // GET /appointments/medical-records — prontuários finalizados
  fastify.get('/medical-records', async (request, reply) => {
    const { prisma } = await import('@sigcmt/database')
    const { search, doctorId, page: rawPage, limit: rawLimit } = request.query as Record<string, string>
    const page = Math.max(1, Number(rawPage) || 1)
    const limit = Math.min(50, Math.max(1, Number(rawLimit) || 20))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      tenantId: request.currentUser.tenantId,
      status: 'COMPLETED',
      notes: { contains: '"status":"finalized"' },
    }
    if (doctorId) where.doctorId = doctorId

    const [records, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          patient: { select: { id: true, fullName: true, birthDate: true } },
          doctor: { select: { id: true, fullName: true } },
          company: { select: { id: true, tradeName: true, legalName: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ])

    const data = records
      .filter(r => {
        if (!search) return true
        const s = search.toLowerCase()
        return (
          r.patient?.fullName?.toLowerCase().includes(s) ||
          r.doctor?.fullName?.toLowerCase().includes(s)
        )
      })
      .map(r => {
        let parsedNotes: Record<string, unknown> = {}
        try { parsedNotes = JSON.parse(r.notes ?? '{}') } catch { /* ok */ }
        return { ...r, parsedNotes }
      })

    return reply.send({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } })
  })

  // POST /appointments/:id/triage — cria ou atualiza triagem
  fastify.post('/:id/triage', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { prisma } = await import('@sigcmt/database')

    const apt = await prisma.appointment.findFirst({ where: { id, tenantId: request.currentUser.tenantId } })
    if (!apt) throw { statusCode: 404, message: 'Agendamento não encontrado.' }

    const body = z.object({
      responses: z.array(z.object({ key: z.string(), label: z.string(), value: z.string() })).default([]),
      currentSymptoms: z.array(z.string()).default([]),
      medicationsInUse: z.array(z.object({ name: z.string(), dosage: z.string().optional() })).default([]),
      riskFlags: z.array(z.string()).default([]),
      accessibilityNeeds: z.record(z.string()).default({}),
      doctorNotes: z.string().optional(),
      status: z.enum(['PENDING','COMPLETED','INCOMPLETE']).default('COMPLETED'),
    }).parse(request.body)

    const existing = await prisma.triage.findUnique({ where: { appointmentId: id } })

    const triage = existing
      ? await prisma.triage.update({
          where: { appointmentId: id },
          data: { ...body, completedAt: body.status === 'COMPLETED' ? new Date() : undefined, updatedAt: new Date() },
        })
      : await prisma.triage.create({
          data: {
            appointmentId: id,
            patientId: apt.patientId,
            performedBy: request.currentUser.id,
            ...body,
            completedAt: body.status === 'COMPLETED' ? new Date() : undefined,
          },
        })

    return reply.send(ok(triage))
  })
}

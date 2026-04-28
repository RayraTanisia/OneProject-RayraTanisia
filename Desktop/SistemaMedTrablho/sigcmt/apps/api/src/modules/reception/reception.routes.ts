import type { FastifyInstance } from 'fastify'
import { ok } from '../../shared/plugins/errorHandler'
import { prisma } from '@sigcmt/database'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
const TZ = 'America/Cuiaba'

export async function receptionRoutes(fastify: FastifyInstance) {
  // GET /api/v1/reception/queue — fila do dia com todos os pacientes
  fastify.get('/queue', async (request, reply) => {
    const tenantId = request.currentUser.tenantId
    const now = dayjs.tz(undefined, TZ)
    const { date } = request.query as { date?: string }
    const target = date ? dayjs.tz(date, TZ) : now

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        scheduledAt: {
          gte: target.startOf('day').toDate(),
          lte: target.endOf('day').toDate(),
        },
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        patient: { select: { id: true, fullName: true, photoUrl: true } },
        doctor: { select: { id: true, fullName: true } },
        room: { select: { id: true, name: true } },
        company: { select: { id: true, tradeName: true, legalName: true } },
        triage: { select: { id: true, status: true, riskFlags: true } },
      },
    })

    const waiting = appointments.filter(a => a.status === 'SCHEDULED' || a.status === 'CONFIRMED')
    const inProgress = appointments.filter(a => a.status === 'IN_PROGRESS')
    const done = appointments.filter(a => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status))

    return reply.send(ok({
      date: target.format('YYYY-MM-DD'),
      total: appointments.length,
      waiting: waiting.length,
      inProgress: inProgress.length,
      done: done.length,
      queue: { waiting, inProgress, done },
    }))
  })

  // GET /api/v1/reception/stats — indicadores do dia em tempo real
  fastify.get('/stats', async (request, reply) => {
    const tenantId = request.currentUser.tenantId
    const now = dayjs.tz(undefined, TZ)

    const [total, waiting, inProgress, done, cancelled, noShow, withTriage] = await Promise.all([
      prisma.appointment.count({ where: { tenantId, scheduledAt: { gte: now.startOf('day').toDate(), lte: now.endOf('day').toDate() } } }),
      prisma.appointment.count({ where: { tenantId, status: { in: ['SCHEDULED', 'CONFIRMED'] }, scheduledAt: { gte: now.startOf('day').toDate(), lte: now.endOf('day').toDate() } } }),
      prisma.appointment.count({ where: { tenantId, status: 'IN_PROGRESS', scheduledAt: { gte: now.startOf('day').toDate(), lte: now.endOf('day').toDate() } } }),
      prisma.appointment.count({ where: { tenantId, status: 'COMPLETED', scheduledAt: { gte: now.startOf('day').toDate(), lte: now.endOf('day').toDate() } } }),
      prisma.appointment.count({ where: { tenantId, status: 'CANCELLED', scheduledAt: { gte: now.startOf('day').toDate(), lte: now.endOf('day').toDate() } } }),
      prisma.appointment.count({ where: { tenantId, status: 'NO_SHOW', scheduledAt: { gte: now.startOf('day').toDate(), lte: now.endOf('day').toDate() } } }),
      prisma.triage.count({ where: { appointment: { tenantId, scheduledAt: { gte: now.startOf('day').toDate(), lte: now.endOf('day').toDate() } } } }),
    ])

    return reply.send(ok({ total, waiting, inProgress, done, cancelled, noShow, withTriage }))
  })

  // POST /api/v1/reception/call/:id — chama paciente para sala
  fastify.post('/call/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { roomId } = request.body as { roomId?: string }
    const tenantId = request.currentUser.tenantId

    const apt = await prisma.appointment.findFirst({ where: { id, tenantId } })
    if (!apt) throw { statusCode: 404, message: 'Agendamento não encontrado.' }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        checkedInAt: apt.checkedInAt ?? new Date(),
        ...(roomId ? { roomId } : {}),
      },
    })
    return reply.send(ok(updated))
  })

  // POST /api/v1/reception/no-show/:id — marcar falta
  fastify.post('/no-show/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const tenantId = request.currentUser.tenantId
    const apt = await prisma.appointment.findFirst({ where: { id, tenantId } })
    if (!apt) throw { statusCode: 404, message: 'Agendamento não encontrado.' }
    const updated = await prisma.appointment.update({ where: { id }, data: { status: 'NO_SHOW' } })
    return reply.send(ok(updated))
  })
}

// Rotas PÚBLICAS de check-in (sem autenticação)
export async function publicCheckinRoutes(fastify: FastifyInstance) {
  // GET /api/v1/public/checkin/:id — busca agendamento pelo ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const apt = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { fullName: true } },
        doctor: { select: { fullName: true } },
        room: { select: { name: true } },
      },
    })
    if (!apt) throw { statusCode: 404, message: 'Agendamento não encontrado.' }
    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(apt.status))
      throw { statusCode: 400, message: 'Este agendamento não está mais ativo.' }

    return reply.send(ok({
      id: apt.id,
      patientName: apt.patient?.fullName,
      doctorName: apt.doctor?.fullName,
      room: apt.room?.name,
      scheduledAt: apt.scheduledAt,
      appointmentType: apt.appointmentType,
      status: apt.status,
    }))
  })

  // POST /api/v1/public/checkin/:id — confirma check-in do paciente
  fastify.post('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const apt = await prisma.appointment.findUnique({ where: { id } })
    if (!apt) throw { statusCode: 404, message: 'Agendamento não encontrado.' }
    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(apt.status))
      throw { statusCode: 400, message: 'Este agendamento não está mais ativo.' }
    if (apt.checkedInAt)
      return reply.send(ok({ alreadyCheckedIn: true, checkedInAt: apt.checkedInAt }))

    const updated = await prisma.appointment.update({
      where: { id },
      data: { checkedInAt: new Date(), status: apt.status === 'SCHEDULED' ? 'CONFIRMED' : apt.status },
    })
    return reply.send(ok({ success: true, checkedInAt: updated.checkedInAt }))
  })
}

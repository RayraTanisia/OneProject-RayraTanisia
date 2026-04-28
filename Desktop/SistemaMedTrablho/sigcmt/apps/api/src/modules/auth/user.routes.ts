import type { FastifyInstance } from 'fastify'
import { prisma } from '@sigcmt/database'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { ok, paginated } from '../../shared/plugins/errorHandler'
import { requireRole } from '../../shared/middleware/authenticate'

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
  fullName: z.string().min(3),
  role: z.enum(['ADMIN','MANAGER','DOCTOR','NURSE','RECEPTIONIST','BILLING','WAREHOUSE','HR','PSYCHOLOGIST']),
  crmNumber: z.string().optional(),
  crmState: z.string().optional(),
  phone: z.string().optional(),
  permissions: z.array(z.string()).optional(),
})

export async function userRoutes(fastify: FastifyInstance) {
  // GET /api/v1/users
  fastify.get('/', { onRequest: [requireRole('ADMIN', 'MANAGER')] }, async (request, reply) => {
    const { page = 1, limit = 20, role, search } = request.query as Record<string, string>
    const tenantId = request.currentUser.tenantId
    const skip = (Number(page) - 1) * Number(limit)

    const where: Record<string, unknown> = { tenantId, active: true }
    if (role) where.role = role
    if (search) where.fullName = { contains: search, mode: 'insensitive' }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        select: { id: true, email: true, fullName: true, role: true, crmNumber: true, crmState: true, phone: true, photoUrl: true, lastLoginAt: true, createdAt: true },
        orderBy: { fullName: 'asc' },
      }),
      prisma.user.count({ where }),
    ])

    return reply.send(paginated(users, total, Number(page), Number(limit)))
  })

  // GET /api/v1/users/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = await prisma.user.findFirst({
      where: { id, tenantId: request.currentUser.tenantId },
      select: { id: true, email: true, fullName: true, role: true, permissions: true, crmNumber: true, crmState: true, phone: true, photoUrl: true, active: true, lastLoginAt: true, createdAt: true },
    })
    if (!user) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } })
    return reply.send(ok(user))
  })

  // POST /api/v1/users
  fastify.post('/', { onRequest: [requireRole('ADMIN', 'MANAGER')] }, async (request, reply) => {
    const body = createUserSchema.parse(request.body)
    const tenantId = request.currentUser.tenantId

    const existing = await prisma.user.findUnique({ where: { tenantId_email: { tenantId, email: body.email } } })
    if (existing) return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'E-mail já cadastrado.' } })

    const passwordHash = await bcrypt.hash(body.password, 12)
    const { password: _pw, ...userData } = body
    const user = await prisma.user.create({
      data: { ...userData, passwordHash, tenantId, permissions: userData.permissions || [] },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    })

    return reply.status(201).send(ok(user))
  })

  // PUT /api/v1/users/:id
  fastify.put('/:id', { onRequest: [requireRole('ADMIN', 'MANAGER')] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createUserSchema.partial().parse(request.body)
    const tenantId = request.currentUser.tenantId

    const existing = await prisma.user.findFirst({ where: { id, tenantId } })
    if (!existing) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } })

    const updateData: Record<string, unknown> = { ...body }
    if (body.password) {
      updateData.passwordHash = await bcrypt.hash(body.password, 12)
      delete updateData.password
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, fullName: true, role: true, updatedAt: true },
    })

    return reply.send(ok(user))
  })

  // DELETE /api/v1/users/:id (soft delete)
  fastify.delete('/:id', { onRequest: [requireRole('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    if (id === request.currentUser.id) {
      return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'Você não pode desativar sua própria conta.' } })
    }
    await prisma.user.update({ where: { id, tenantId: request.currentUser.tenantId }, data: { active: false } })
    return reply.send(ok({ message: 'Usuário desativado com sucesso.' }))
  })

  // GET /api/v1/users/doctors/available
  fastify.get('/doctors/available', async (request, reply) => {
    const doctors = await prisma.user.findMany({
      where: { tenantId: request.currentUser.tenantId, role: 'DOCTOR', active: true },
      select: {
        id: true, fullName: true, crmNumber: true, crmState: true, photoUrl: true,
        doctorSchedules: { where: { active: true }, select: { dayOfWeek: true, startTime: true, endTime: true, slotDurationMin: true } },
      },
      orderBy: { fullName: 'asc' },
    })
    return reply.send(ok(doctors))
  })

  // GET /api/v1/users/:id/schedules
  fastify.get('/:id/schedules', async (request, reply) => {
    const { id } = request.params as { id: string }
    const doctor = await prisma.user.findFirst({ where: { id, tenantId: request.currentUser.tenantId } })
    if (!doctor) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } })
    const schedules = await prisma.doctorSchedule.findMany({ where: { doctorId: id }, orderBy: { dayOfWeek: 'asc' } })
    return reply.send(ok(schedules))
  })

  // PUT /api/v1/users/:id/schedules — substitui toda a agenda do médico
  fastify.put('/:id/schedules', { onRequest: [requireRole('ADMIN', 'MANAGER')] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const doctor = await prisma.user.findFirst({ where: { id, tenantId: request.currentUser.tenantId, role: 'DOCTOR' } })
    if (!doctor) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Médico não encontrado.' } })

    const scheduleSchema = z.array(z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      slotDurationMin: z.number().int().positive().default(30),
      breakStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      breakEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      active: z.boolean().default(true),
    }))
    const body = scheduleSchema.parse(request.body)

    await prisma.$transaction(async (tx) => {
      await tx.doctorSchedule.deleteMany({ where: { doctorId: id } })
      for (const s of body) {
        await tx.doctorSchedule.create({ data: { ...s, doctorId: id } })
      }
    })

    const schedules = await prisma.doctorSchedule.findMany({ where: { doctorId: id }, orderBy: { dayOfWeek: 'asc' } })
    return reply.send(ok(schedules))
  })
}

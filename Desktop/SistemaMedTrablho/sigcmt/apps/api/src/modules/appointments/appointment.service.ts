import { prisma } from '@sigcmt/database'
import { z } from 'zod'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { sendAppointmentConfirmation, sendAppointmentCancellation } from '../../shared/services/email.service'
import { safeDecrypt } from '../../shared/utils/crypto'

dayjs.extend(utc)
dayjs.extend(timezone)

const TZ = 'America/Cuiaba'

export const createAppointmentSchema = z.object({
  patientId: z.string().uuid('ID do paciente inválido'),
  doctorId: z.string().uuid('ID do médico inválido'),
  roomId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  appointmentType: z.enum(['INITIAL','PERIODIC','DISMISSAL','ASO','FOLLOWUP','RETURN']).default('INITIAL'),
  scheduledAt: z.string().datetime('Data/hora inválida'),
  durationMinutes: z.number().int().positive().default(30),
  notes: z.string().optional(),
  bookingChannel: z.string().default('web_portal'),
})

export const updateAppointmentSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
  roomId: z.string().uuid().optional(),
  status: z.enum(['SCHEDULED','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW']).optional(),
  notes: z.string().optional(),
})

export const listAppointmentsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  doctorId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  date: z.string().optional(),
})

export class AppointmentService {
  async list(tenantId: string, query: z.infer<typeof listAppointmentsSchema>) {
    const { page, limit, doctorId, patientId, status, dateFrom, dateTo, date } = query
    const skip = (page - 1) * limit
    const where: Record<string, unknown> = { tenantId }
    if (doctorId) where.doctorId = doctorId
    if (patientId) where.patientId = patientId
    if (status) where.status = status
    if (date) {
      where.scheduledAt = {
        gte: dayjs.tz(date, TZ).startOf('day').toDate(),
        lte: dayjs.tz(date, TZ).endOf('day').toDate(),
      }
    } else if (dateFrom || dateTo) {
      const range: Record<string, Date> = {}
      if (dateFrom) range.gte = dayjs.tz(dateFrom, TZ).startOf('day').toDate()
      if (dateTo) range.lte = dayjs.tz(dateTo, TZ).endOf('day').toDate()
      where.scheduledAt = range
    }
    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where, skip, take: limit, orderBy: { scheduledAt: 'asc' },
        include: {
          patient: { select: { id: true, fullName: true, photoUrl: true } },
          doctor: { select: { id: true, fullName: true, crmNumber: true } },
          room: { select: { id: true, name: true } },
          company: { select: { id: true, tradeName: true, legalName: true } },
          triage: { select: { id: true, status: true, riskFlags: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ])
    return { data: appointments, total, page, limit }
  }

  async findById(id: string, tenantId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        patient: { select: { id: true, fullName: true, birthDate: true, gender: true, photoUrl: true, allergies: true, continuousMedications: true } },
        doctor: { select: { id: true, fullName: true, crmNumber: true, crmState: true } },
        room: { select: { id: true, name: true, equipment: true } },
        company: { select: { id: true, tradeName: true, legalName: true } },
        triage: true,
      },
    })
    if (!appointment) throw { statusCode: 404, message: 'Agendamento não encontrado.' }
    return appointment
  }

  async getAvailableSlots(tenantId: string, doctorId: string, date: string) {
    const dayObj = dayjs.tz(date, TZ)
    const dayOfWeek = dayObj.day()
    const scheduleDb = await prisma.doctorSchedule.findUnique({
      where: { doctorId_dayOfWeek: { doctorId, dayOfWeek } },
    })

    // Usa horário padrão 08:00-18:00 (30min) caso nenhuma agenda esteja cadastrada
    const schedule = scheduleDb ?? {
      startTime: '08:00', endTime: '18:00', slotDurationMin: 30,
      breakStart: '12:00', breakEnd: '13:00', active: true,
    }
    if (!schedule.active) return { date, slots: [], reason: 'Médico não atende neste dia da semana.' }

    const [sH, sM] = schedule.startTime.split(':').map(Number)
    const [eH, eM] = schedule.endTime.split(':').map(Number)
    const bkS = schedule.breakStart?.split(':').map(Number)
    const bkE = schedule.breakEnd?.split(':').map(Number)

    const slots: { time: string; datetime: string; available: boolean; reason?: string }[] = []
    let cur = dayObj.hour(sH).minute(sM).second(0)
    const end = dayObj.hour(eH).minute(eM).second(0)

    while (cur.isBefore(end)) {
      const slotEnd = cur.add(schedule.slotDurationMin, 'minute')
      let inBreak = false
      if (bkS && bkE) {
        const bS = dayObj.hour(bkS[0]).minute(bkS[1]).second(0)
        const bE = dayObj.hour(bkE[0]).minute(bkE[1]).second(0)
        if (cur.isBefore(bE) && slotEnd.isAfter(bS)) inBreak = true
      }
      const isPast = cur.isBefore(dayjs())
      slots.push({ time: cur.format('HH:mm'), datetime: cur.toISOString(), available: !inBreak && !isPast, reason: inBreak ? 'Intervalo' : isPast ? 'Passado' : undefined })
      cur = slotEnd
    }

    const existing = await prisma.appointment.findMany({
      where: { tenantId, doctorId, status: { notIn: ['CANCELLED', 'NO_SHOW'] }, scheduledAt: { gte: dayObj.startOf('day').toDate(), lte: dayObj.endOf('day').toDate() } },
      select: { scheduledAt: true, durationMinutes: true },
    })

    for (const apt of existing) {
      const aS = dayjs(apt.scheduledAt)
      const aE = aS.add(apt.durationMinutes, 'minute')
      for (const slot of slots) {
        const sT = dayjs(slot.datetime)
        if (sT.isBefore(aE) && sT.add(schedule.slotDurationMin, 'minute').isAfter(aS)) {
          slot.available = false
          slot.reason = 'Ocupado'
        }
      }
    }

    const available = slots.filter(s => s.available).length
    return {
      date, doctorId, slotDurationMin: schedule.slotDurationMin,
      totalSlots: slots.length, availableSlots: available,
      occupancyPct: slots.length > 0 ? Math.round(((slots.length - available) / slots.length) * 100) : 0,
      slots,
    }
  }

  async create(tenantId: string, data: z.infer<typeof createAppointmentSchema>) {
    const scheduledAt = new Date(data.scheduledAt)
    const [doctor, patient] = await Promise.all([
      prisma.user.findFirst({ where: { id: data.doctorId, tenantId, role: 'DOCTOR', active: true } }),
      prisma.patient.findFirst({ where: { id: data.patientId, tenantId, deletedAt: null } }),
    ])
    if (!doctor) throw { statusCode: 404, message: 'Médico não encontrado.' }
    if (!patient) throw { statusCode: 404, message: 'Paciente não encontrado.' }

    const conflict = await prisma.appointment.findFirst({
      where: {
        tenantId, doctorId: data.doctorId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        scheduledAt: { gte: scheduledAt, lt: new Date(scheduledAt.getTime() + data.durationMinutes * 60000) },
      },
    })
    if (conflict) throw { statusCode: 409, message: 'Médico já possui agendamento neste horário.' }

    const appointment = await prisma.appointment.create({
      data: {
        tenantId, patientId: data.patientId, doctorId: data.doctorId,
        roomId: data.roomId, companyId: data.companyId,
        appointmentType: data.appointmentType, scheduledAt,
        durationMinutes: data.durationMinutes, notes: data.notes,
        bookingChannel: data.bookingChannel, status: 'SCHEDULED',
      },
      include: {
        patient: { select: { id: true, fullName: true, emailEncrypted: true } },
        doctor: { select: { id: true, fullName: true } },
        room: { select: { id: true, name: true } },
      },
    })

    const patientEmail = safeDecrypt(appointment.patient?.emailEncrypted)
    if (patientEmail) {
      const TYPE_LABELS: Record<string, string> = {
        INITIAL: 'Consulta Inicial', PERIODIC: 'Periódico', DISMISSAL: 'Demissional',
        ASO: 'ASO', FOLLOWUP: 'Acompanhamento', RETURN: 'Retorno',
      }
      sendAppointmentConfirmation({
        to: patientEmail,
        patientName: appointment.patient.fullName,
        doctorName: appointment.doctor?.fullName ?? '',
        date: dayjs(scheduledAt).format('DD/MM/YYYY'),
        time: dayjs(scheduledAt).format('HH:mm'),
        type: TYPE_LABELS[data.appointmentType] ?? data.appointmentType,
      }).catch((err) => console.error('[email] confirmação falhou:', err))
    }

    return appointment
  }

  async update(id: string, tenantId: string, data: z.infer<typeof updateAppointmentSchema>) {
    const existing = await prisma.appointment.findFirst({ where: { id, tenantId } })
    if (!existing) throw { statusCode: 404, message: 'Agendamento não encontrado.' }
    if (['COMPLETED', 'CANCELLED'].includes(existing.status))
      throw { statusCode: 400, message: 'Não é possível editar um agendamento já finalizado ou cancelado.' }
    return prisma.appointment.update({
      where: { id },
      data: {
        ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
        ...(data.durationMinutes && { durationMinutes: data.durationMinutes }),
        ...(data.roomId !== undefined && { roomId: data.roomId }),
        ...(data.status && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    })
  }

  async confirm(id: string, tenantId: string, channel = 'system') {
    const existing = await prisma.appointment.findFirst({ where: { id, tenantId } })
    if (!existing) throw { statusCode: 404, message: 'Agendamento não encontrado.' }
    if (existing.status !== 'SCHEDULED') throw { statusCode: 400, message: 'Apenas agendamentos pendentes podem ser confirmados.' }
    return prisma.appointment.update({ where: { id }, data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmationChannel: channel } })
  }

  async checkIn(id: string, tenantId: string) {
    const existing = await prisma.appointment.findFirst({ where: { id, tenantId } })
    if (!existing) throw { statusCode: 404, message: 'Agendamento não encontrado.' }
    if (!['SCHEDULED', 'CONFIRMED'].includes(existing.status))
      throw { statusCode: 400, message: 'Check-in não permitido para este status.' }
    return prisma.appointment.update({ where: { id }, data: { checkedInAt: new Date(), status: 'CONFIRMED' } })
  }

  async cancel(id: string, tenantId: string, reason: string, cancelledBy: string) {
    const existing = await prisma.appointment.findFirst({
      where: { id, tenantId },
      include: { patient: { select: { fullName: true, emailEncrypted: true } }, doctor: { select: { fullName: true } } },
    })
    if (!existing) throw { statusCode: 404, message: 'Agendamento não encontrado.' }
    if (['COMPLETED', 'CANCELLED'].includes(existing.status))
      throw { statusCode: 400, message: 'Agendamento já está finalizado ou cancelado.' }

    const updated = await prisma.appointment.update({ where: { id }, data: { status: 'CANCELLED', cancellationReason: reason, cancelledBy } })

    const cancelEmail = safeDecrypt(existing.patient?.emailEncrypted)
    if (cancelEmail) {
      sendAppointmentCancellation({
        to: cancelEmail,
        patientName: existing.patient.fullName,
        doctorName: existing.doctor?.fullName ?? '',
        date: dayjs(existing.scheduledAt).format('DD/MM/YYYY'),
        time: dayjs(existing.scheduledAt).format('HH:mm'),
        reason,
      }).catch((err) => console.error('[email] cancelamento falhou:', err))
    }

    return updated
  }

  async getDashboardStats(tenantId: string) {
    const today = dayjs.tz(undefined, TZ)
    const todayStart = today.startOf('day').toDate()
    const todayEnd = today.endOf('day').toDate()
    const monthStart = today.startOf('month').toDate()

    const [todayTotal, todayConfirmed, todayCancelled, todayCompleted, monthTotal, totalPatients, newPatientsMonth] = await Promise.all([
      prisma.appointment.count({ where: { tenantId, scheduledAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.appointment.count({ where: { tenantId, scheduledAt: { gte: todayStart, lte: todayEnd }, status: { in: ['CONFIRMED', 'COMPLETED'] } } }),
      prisma.appointment.count({ where: { tenantId, scheduledAt: { gte: todayStart, lte: todayEnd }, status: 'CANCELLED' } }),
      prisma.appointment.count({ where: { tenantId, scheduledAt: { gte: todayStart, lte: todayEnd }, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { tenantId, scheduledAt: { gte: monthStart } } }),
      prisma.patient.count({ where: { tenantId, deletedAt: null, status: 'ACTIVE' } }),
      prisma.patient.count({ where: { tenantId, deletedAt: null, createdAt: { gte: monthStart } } }),
    ])

    return {
      today: { total: todayTotal, confirmed: todayConfirmed, cancelled: todayCancelled, completed: todayCompleted, attendanceRate: todayTotal > 0 ? Math.round((todayConfirmed / todayTotal) * 100) : 0 },
      month: { totalAppointments: monthTotal, newPatients: newPatientsMonth },
      totals: { activePatients: totalPatients },
    }
  }
}

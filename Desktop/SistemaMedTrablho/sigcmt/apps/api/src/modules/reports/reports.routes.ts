import type { FastifyInstance } from 'fastify'
import { prisma } from '@sigcmt/database'
import { ok } from '../../shared/plugins/errorHandler'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
const TZ = 'America/Cuiaba'

export async function reportsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/reports/overview  — dados gerais para a página de relatórios
  fastify.get('/overview', async (request, reply) => {
    const tenantId = request.currentUser.tenantId
    const now = dayjs.tz(undefined, TZ)
    const { months: monthsParam = '6' } = request.query as { months?: string }
    const numMonths = Math.min(12, Math.max(1, Number(monthsParam) || 6))

    const months = Array.from({ length: numMonths }, (_, i) => {
      const m = now.subtract(numMonths - 1 - i, 'month')
      return { label: m.format('MMM/YY'), start: m.startOf('month').toDate(), end: m.endOf('month').toDate() }
    })

    const periodStart = months[0].start
    const periodEnd = months[months.length - 1].end

    const [monthlyData, typeBreakdown, topCompanies, patientGrowth, asoStats, topDoctors, noShowCount, completedCount, totalInPeriod] = await Promise.all([
      // Agendamentos por mês
      Promise.all(months.map(async m => ({
        label: m.label,
        total: await prisma.appointment.count({ where: { tenantId, scheduledAt: { gte: m.start, lte: m.end } } }),
        completed: await prisma.appointment.count({ where: { tenantId, scheduledAt: { gte: m.start, lte: m.end }, status: 'COMPLETED' } }),
        cancelled: await prisma.appointment.count({ where: { tenantId, scheduledAt: { gte: m.start, lte: m.end }, status: 'CANCELLED' } }),
      }))),

      // Tipos de consulta no período
      prisma.appointment.groupBy({
        by: ['appointmentType'],
        where: { tenantId, scheduledAt: { gte: periodStart, lte: periodEnd } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // Top 5 empresas por consultas no período
      prisma.appointment.groupBy({
        by: ['companyId'],
        where: { tenantId, companyId: { not: null }, scheduledAt: { gte: periodStart, lte: periodEnd } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),

      // Crescimento de pacientes por mês
      Promise.all(months.map(async m => ({
        label: m.label,
        new: await prisma.patient.count({ where: { tenantId, deletedAt: null, createdAt: { gte: m.start, lte: m.end } } }),
      }))),

      // ASOs por mês
      Promise.all(months.map(async m => {
        try {
          return { label: m.label, total: await prisma.aso.count({ where: { tenantId, issuedAt: { gte: m.start, lte: m.end } } }) }
        } catch { return { label: m.label, total: 0 } }
      })),

      // Top 5 médicos por consultas no período
      prisma.appointment.groupBy({
        by: ['doctorId'],
        where: { tenantId, scheduledAt: { gte: periodStart, lte: periodEnd } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),

      // Faltas no período
      prisma.appointment.count({ where: { tenantId, status: 'NO_SHOW', scheduledAt: { gte: periodStart, lte: periodEnd } } }),

      // Concluídos no período
      prisma.appointment.count({ where: { tenantId, status: 'COMPLETED', scheduledAt: { gte: periodStart, lte: periodEnd } } }),

      // Total no período (excluindo cancelados)
      prisma.appointment.count({ where: { tenantId, status: { notIn: ['CANCELLED'] }, scheduledAt: { gte: periodStart, lte: periodEnd } } }),
    ])

    // Enriquecer empresas com nomes
    const companyIds = topCompanies.map(c => c.companyId).filter(Boolean) as string[]
    const companies = companyIds.length > 0
      ? await prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, tradeName: true, legalName: true } })
      : []
    const companyMap = Object.fromEntries(companies.map(c => [c.id, c.tradeName || c.legalName]))
    const topCompaniesEnriched = topCompanies.map(c => ({
      companyId: c.companyId,
      name: companyMap[c.companyId!] || 'Desconhecida',
      count: c._count.id,
    }))

    // Enriquecer médicos com nomes
    const doctorIds = topDoctors.map(d => d.doctorId).filter(Boolean) as string[]
    const doctors = doctorIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: doctorIds } }, select: { id: true, fullName: true, crmNumber: true } })
      : []
    const doctorMap = Object.fromEntries(doctors.map(d => [d.id, { name: d.fullName, crm: d.crmNumber }]))
    const topDoctorsEnriched = topDoctors.map(d => ({
      doctorId: d.doctorId,
      name: doctorMap[d.doctorId]?.name || 'Desconhecido',
      crm: doctorMap[d.doctorId]?.crm || '',
      count: d._count.id,
    }))

    // Totais gerais
    let totalAsos = 0
    try { totalAsos = await prisma.aso.count({ where: { tenantId } }) } catch { /* ok */ }

    const [totalPatients, totalCompanies, todayCount] = await Promise.all([
      prisma.patient.count({ where: { tenantId, deletedAt: null, status: 'ACTIVE' } }),
      prisma.company.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.appointment.count({ where: { tenantId, scheduledAt: { gte: now.startOf('day').toDate(), lte: now.endOf('day').toDate() } } }),
    ])

    const attendanceRate = totalInPeriod > 0 ? Math.round((completedCount / totalInPeriod) * 100) : 0
    const noShowRate = totalInPeriod > 0 ? Math.round((noShowCount / totalInPeriod) * 100) : 0

    return reply.send(ok({
      totals: { patients: totalPatients, companies: totalCompanies, asos: totalAsos, today: todayCount },
      monthly: monthlyData,
      patientGrowth,
      typeBreakdown: typeBreakdown.map(t => ({ type: t.appointmentType, count: t._count.id })),
      topCompanies: topCompaniesEnriched,
      topDoctors: topDoctorsEnriched,
      asoStats,
      attendance: { completedCount, noShowCount, totalInPeriod, attendanceRate, noShowRate },
    }))
  })
}

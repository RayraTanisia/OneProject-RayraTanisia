import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc,
  query, where, orderBy, limit, Timestamp, serverTimestamp,
  QueryDocumentSnapshot
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Appointment, AppointmentStatus, DoctorSchedule } from '../types'
import dayjs from 'dayjs'

const COL = 'appointments'

function toAppointment(snap: QueryDocumentSnapshot): Appointment {
  const d = snap.data()
  return {
    id: snap.id,
    patientId: d.patientId,
    patientName: d.patientName,
    doctorId: d.doctorId,
    doctorName: d.doctorName,
    roomId: d.roomId,
    roomName: d.roomName,
    companyId: d.companyId,
    companyName: d.companyName,
    appointmentType: d.appointmentType,
    scheduledAt: d.scheduledAt?.toDate?.()?.toISOString() || d.scheduledAt,
    durationMinutes: d.durationMinutes || 30,
    status: d.status,
    confirmedAt: d.confirmedAt?.toDate?.()?.toISOString(),
    checkedInAt: d.checkedInAt?.toDate?.()?.toISOString(),
    startedAt: d.startedAt?.toDate?.()?.toISOString(),
    endedAt: d.endedAt?.toDate?.()?.toISOString(),
    cancellationReason: d.cancellationReason,
    cancelledBy: d.cancelledBy,
    bookingChannel: d.bookingChannel || 'web',
    notes: d.notes,
    createdBy: d.createdBy,
    createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt,
    updatedAt: d.updatedAt?.toDate?.()?.toISOString() || d.updatedAt,
  }
}

export const appointmentService = {
  // Listar por data (dia específico)
  async listByDate(date: string): Promise<Appointment[]> {
    const start = Timestamp.fromDate(dayjs(date).startOf('day').toDate())
    const end   = Timestamp.fromDate(dayjs(date).endOf('day').toDate())
    const q = query(
      collection(db, COL),
      where('scheduledAt', '>=', start),
      where('scheduledAt', '<=', end),
      orderBy('scheduledAt')
    )
    const snap = await getDocs(q)
    return snap.docs.map(toAppointment)
  },

  // Listar por intervalo de datas (para calendário mensal)
  async listByRange(from: string, to: string): Promise<Appointment[]> {
    const start = Timestamp.fromDate(dayjs(from).startOf('day').toDate())
    const end   = Timestamp.fromDate(dayjs(to).endOf('day').toDate())
    const q = query(
      collection(db, COL),
      where('scheduledAt', '>=', start),
      where('scheduledAt', '<=', end),
      orderBy('scheduledAt')
    )
    const snap = await getDocs(q)
    return snap.docs.map(toAppointment)
  },

  // Buscar por ID
  async getById(id: string): Promise<Appointment | null> {
    const snap = await getDoc(doc(db, COL, id))
    if (!snap.exists()) return null
    return toAppointment(snap as QueryDocumentSnapshot)
  },

  // Calcular slots disponíveis
  async getAvailableSlots(doctorId: string, date: string): Promise<{
    time: string; datetime: string; available: boolean; reason?: string
  }[]> {
    // Buscar agenda do médico para esse dia
    const dayOfWeek = dayjs(date).day()
    const scheduleSnap = await getDocs(
      query(collection(db, 'doctorSchedules'),
        where('doctorId', '==', doctorId),
        where('dayOfWeek', '==', dayOfWeek),
        where('active', '==', true)
      )
    )

    if (scheduleSnap.empty) return []
    const schedule = scheduleSnap.docs[0].data() as DoctorSchedule

    // Gerar slots
    const [sH, sM] = schedule.startTime.split(':').map(Number)
    const [eH, eM] = schedule.endTime.split(':').map(Number)
    const bkS = schedule.breakStart?.split(':').map(Number)
    const bkE = schedule.breakEnd?.split(':').map(Number)
    const dur = schedule.slotDurationMin || 30

    const slots: { time: string; datetime: string; available: boolean; reason?: string }[] = []
    let cur = dayjs(date).hour(sH).minute(sM).second(0)
    const end = dayjs(date).hour(eH).minute(eM).second(0)

    while (cur.isBefore(end)) {
      const slotEnd = cur.add(dur, 'minute')
      let inBreak = false
      if (bkS && bkE) {
        const bS = dayjs(date).hour(bkS[0]).minute(bkS[1]).second(0)
        const bE = dayjs(date).hour(bkE[0]).minute(bkE[1]).second(0)
        if (cur.isBefore(bE) && slotEnd.isAfter(bS)) inBreak = true
      }
      const isPast = cur.isBefore(dayjs())
      slots.push({
        time: cur.format('HH:mm'),
        datetime: cur.toISOString(),
        available: !inBreak && !isPast,
        reason: inBreak ? 'Intervalo' : isPast ? 'Passado' : undefined,
      })
      cur = slotEnd
    }

    // Marcar slots já agendados como ocupados
    const existing = await this.listByDate(date)
    const doctorApts = existing.filter(a =>
      a.doctorId === doctorId && !['CANCELLED', 'NO_SHOW'].includes(a.status)
    )

    for (const apt of doctorApts) {
      const aS = dayjs(apt.scheduledAt)
      const aE = aS.add(apt.durationMinutes, 'minute')
      for (const slot of slots) {
        const sT = dayjs(slot.datetime)
        if (sT.isBefore(aE) && sT.add(dur, 'minute').isAfter(aS)) {
          slot.available = false
          slot.reason = 'Ocupado'
        }
      }
    }

    return slots
  },

  // Criar agendamento
  async create(data: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ref = await addDoc(collection(db, COL), {
      ...data,
      scheduledAt: Timestamp.fromDate(new Date(data.scheduledAt)),
      status: 'SCHEDULED',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  },

  // Confirmar
  async confirm(id: string): Promise<void> {
    await updateDoc(doc(db, COL, id), {
      status: 'CONFIRMED',
      confirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  // Check-in
  async checkIn(id: string): Promise<void> {
    await updateDoc(doc(db, COL, id), {
      checkedInAt: serverTimestamp(),
      status: 'CONFIRMED',
      updatedAt: serverTimestamp(),
    })
  },

  // Cancelar
  async cancel(id: string, reason: string, cancelledBy: string): Promise<void> {
    await updateDoc(doc(db, COL, id), {
      status: 'CANCELLED',
      cancellationReason: reason,
      cancelledBy,
      updatedAt: serverTimestamp(),
    })
  },

  // Atualizar status genérico
  async updateStatus(id: string, status: AppointmentStatus): Promise<void> {
    await updateDoc(doc(db, COL, id), { status, updatedAt: serverTimestamp() })
  },

  // Stats do dashboard
  async getDashboardStats(date: string) {
    const apts = await this.listByDate(date)
    const total = apts.length
    const confirmed = apts.filter(a => ['CONFIRMED', 'COMPLETED'].includes(a.status)).length
    const cancelled = apts.filter(a => a.status === 'CANCELLED').length
    const completed = apts.filter(a => a.status === 'COMPLETED').length
    return {
      total, confirmed, cancelled, completed,
      attendanceRate: total > 0 ? Math.round((confirmed / total) * 100) : 0,
    }
  },
}

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { ChevronLeft, ChevronRight, Plus, Loader2 } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'
import clsx from 'clsx'
dayjs.locale('pt-br')

const statusColor: Record<string, string> = {
  SCHEDULED:'bg-blue-500', CONFIRMED:'bg-green-500', IN_PROGRESS:'bg-yellow-500',
  COMPLETED:'bg-gray-400', CANCELLED:'bg-red-400', NO_SHOW:'bg-orange-400'
}

export default function AppointmentCalendarPage() {
  const [current, setCurrent] = useState(dayjs())
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'))

  const monthStart = current.startOf('month').format('YYYY-MM-DD')
  const monthEnd = current.endOf('month').format('YYYY-MM-DD')

  const { data: monthData, isLoading } = useQuery({
    queryKey: ['appointments-month', monthStart, monthEnd],
    queryFn: () => api.get('/appointments', { params: { dateFrom: monthStart, dateTo: monthEnd, limit: 200 } }).then(r => r.data.data),
  })

  const { data: dayData } = useQuery({
    queryKey: ['appointments-day', selectedDate],
    queryFn: () => api.get('/appointments', { params: { date: selectedDate, limit: 50 } }).then(r => r.data.data),
  })

  const typeLabel: Record<string, string> = {
    INITIAL:'Inicial', PERIODIC:'Periódico', DISMISSAL:'Demissional', ASO:'ASO', FOLLOWUP:'Acomp.', RETURN:'Retorno'
  }

  // Agrupar por dia
  const byDay: Record<string, any[]> = {}
  if (monthData) {
    for (const apt of monthData) {
      const d = dayjs(apt.scheduledAt).format('YYYY-MM-DD')
      if (!byDay[d]) byDay[d] = []
      byDay[d].push(apt)
    }
  }

  // Dias do calendário
  const firstDay = current.startOf('month').day() // 0=Dom
  const daysInMonth = current.daysInMonth()
  const calDays: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (calDays.length % 7 !== 0) calDays.push(null)

  const weekDays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1>Calendário</h1>
        <Link to="/appointments/new" className="btn-primary btn-sm"><Plus size={14}/> Novo</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendário */}
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <button onClick={() => setCurrent(c => c.subtract(1,'month'))} className="btn-ghost btn-sm"><ChevronLeft size={16}/></button>
            <h2 className="text-base font-semibold capitalize">{current.format('MMMM [de] YYYY')}</h2>
            <button onClick={() => setCurrent(c => c.add(1,'month'))} className="btn-ghost btn-sm"><ChevronRight size={16}/></button>
          </div>
          <div className="p-4">
            {/* Header dias */}
            <div className="grid grid-cols-7 mb-2">
              {weekDays.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
              ))}
            </div>
            {/* Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500"/></div>
            ) : (
              <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-lg overflow-hidden">
                {calDays.map((day, i) => {
                  if (!day) return <div key={i} className="bg-gray-50 min-h-[72px]" />
                  const dateStr = current.date(day).format('YYYY-MM-DD')
                  const isToday = dateStr === dayjs().format('YYYY-MM-DD')
                  const isSelected = dateStr === selectedDate
                  const dayApts = byDay[dateStr] || []

                  return (
                    <button key={i} onClick={() => setSelectedDate(dateStr)}
                      className={clsx(
                        'min-h-[72px] p-1.5 text-left transition-colors',
                        isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : 'bg-white hover:bg-gray-50',
                      )}
                    >
                      <span className={clsx(
                        'text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1',
                        isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
                      )}>{day}</span>
                      <div className="space-y-0.5">
                        {dayApts.slice(0, 3).map((apt: any) => (
                          <div key={apt.id} className={`text-white text-xs rounded px-1 truncate ${statusColor[apt.status] || 'bg-gray-400'}`}>
                            {dayjs(apt.scheduledAt).format('HH:mm')} {apt.patient?.fullName?.split(' ')[0]}
                          </div>
                        ))}
                        {dayApts.length > 3 && <div className="text-xs text-gray-400">+{dayApts.length - 3} mais</div>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detalhe do dia selecionado */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-sm font-semibold capitalize">{dayjs(selectedDate).format('dddd, D [de] MMMM')}</h2>
            <Link to={`/appointments/new`} className="btn-primary btn-sm"><Plus size={12}/></Link>
          </div>
          <div className="divide-y divide-gray-100">
            {!dayData?.length ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-gray-400">Nenhum agendamento</p>
              </div>
            ) : dayData.map((apt: any) => (
              <Link key={apt.id} to={`/appointments/${apt.id}`} className="flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="text-center w-10 flex-shrink-0">
                  <p className="text-xs font-bold text-gray-800">{dayjs(apt.scheduledAt).format('HH:mm')}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{apt.patient?.fullName}</p>
                  <p className="text-xs text-gray-400">{typeLabel[apt.appointmentType]}</p>
                </div>
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusColor[apt.status] || 'bg-gray-400'}`} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

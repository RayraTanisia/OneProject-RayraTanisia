import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { appointmentService } from '../../lib/appointments'
import { APPOINTMENT_TYPE_LABEL, APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_COLOR, APPOINTMENT_STATUS_DOT } from '../../types'
import { ChevronLeft, ChevronRight, Plus, Loader2 } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'
import clsx from 'clsx'
dayjs.locale('pt-br')

export default function AppointmentCalendarPage() {
  const [current, setCurrent] = useState(dayjs())
  const [selected, setSelected] = useState(dayjs().format('YYYY-MM-DD'))

  const monthFrom = current.startOf('month').format('YYYY-MM-DD')
  const monthTo   = current.endOf('month').format('YYYY-MM-DD')

  const { data: monthApts = [], isLoading } = useQuery({
    queryKey: ['apts-month', monthFrom, monthTo],
    queryFn: () => appointmentService.listByRange(monthFrom, monthTo),
  })

  const { data: dayApts = [] } = useQuery({
    queryKey: ['apts', selected],
    queryFn: () => appointmentService.listByDate(selected),
  })

  const byDay: Record<string, any[]> = {}
  for (const a of monthApts) {
    const d = dayjs(a.scheduledAt).format('YYYY-MM-DD')
    if (!byDay[d]) byDay[d] = []
    byDay[d].push(a)
  }

  const firstDay = current.startOf('month').day()
  const days = current.daysInMonth()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendário</h1>
        <Link to="/appointments/new" className="btn-primary btn-sm"><Plus size={14}/> Novo</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <button onClick={() => setCurrent(c => c.subtract(1,'month'))} className="btn-ghost btn-sm"><ChevronLeft size={16}/></button>
            <h2 className="text-base font-semibold capitalize">{current.format('MMMM [de] YYYY')}</h2>
            <button onClick={() => setCurrent(c => c.add(1,'month'))} className="btn-ghost btn-sm"><ChevronRight size={16}/></button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 mb-1">
              {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
              ))}
            </div>
            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-blue-500"/></div>
            ) : (
              <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-lg overflow-hidden">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} className="bg-gray-50 min-h-[70px]"/>
                  const dateStr = current.date(day).format('YYYY-MM-DD')
                  const isToday = dateStr === dayjs().format('YYYY-MM-DD')
                  const isSel = dateStr === selected
                  const dayItems = byDay[dateStr] || []
                  return (
                    <button key={i} onClick={() => setSelected(dateStr)} className={clsx('min-h-[70px] p-1.5 text-left transition-colors', isSel ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : 'bg-white hover:bg-gray-50')}>
                      <span className={clsx('text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1', isToday ? 'bg-blue-600 text-white' : 'text-gray-700')}>{day}</span>
                      <div className="space-y-px">
                        {dayItems.slice(0,3).map((a: any) => (
                          <div key={a.id} className={`w-full h-1.5 rounded-full ${APPOINTMENT_STATUS_DOT[a.status as keyof typeof APPOINTMENT_STATUS_DOT] || 'bg-gray-400'}`}/>
                        ))}
                        {dayItems.length > 3 && <p className="text-xs text-gray-400">+{dayItems.length - 3}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-xs font-semibold capitalize text-gray-600">{dayjs(selected).format('dddd, D [de] MMMM')}</h2>
            <Link to="/appointments/new" className="btn-primary btn-sm"><Plus size={12}/></Link>
          </div>
          <div className="divide-y divide-gray-100">
            {!dayApts.length ? (
              <div className="px-4 py-10 text-center"><p className="text-sm text-gray-400">Nenhum agendamento</p></div>
            ) : dayApts.map(apt => (
              <Link key={apt.id} to={'/appointments'} className="flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-10 flex-shrink-0 text-center">
                  <p className="text-xs font-bold text-gray-800">{dayjs(apt.scheduledAt).format('HH:mm')}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{apt.patientName}</p>
                  <p className="text-xs text-gray-400">{APPOINTMENT_TYPE_LABEL[apt.appointmentType]}</p>
                </div>
                <span className={`badge text-xs ${APPOINTMENT_STATUS_COLOR[apt.status]}`}>{APPOINTMENT_STATUS_LABEL[apt.status]}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { appointmentService } from '../../lib/appointments'
import { APPOINTMENT_TYPE_LABEL, APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_COLOR } from '../../types'
import { Plus, Calendar, Loader2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'

export default function AppointmentListPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const qc = useQueryClient()

  const { data: apts = [], isLoading } = useQuery({
    queryKey: ['apts', date],
    queryFn: () => appointmentService.listByDate(date),
    refetchInterval: 30_000,
  })

  const confirm = useMutation({
    mutationFn: (id: string) => appointmentService.confirm(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['apts'] }); toast.success('Confirmado!') },
  })
  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => appointmentService.cancel(id, reason, 'user'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['apts'] }); toast.success('Cancelado.') },
  })

  function handleCancel(id: string) {
    const reason = prompt('Motivo do cancelamento:')
    if (!reason || reason.trim().length < 3) return
    cancel.mutate({ id, reason })
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agendamentos</h1>
          <p className="text-gray-500 text-sm mt-0.5">{apts.length} no dia selecionado</p>
        </div>
        <div className="flex gap-2">
          <Link to="/appointments/calendar" className="btn-secondary btn-sm"><Calendar size={14} /> Calendário</Link>
          <Link to="/appointments/new" className="btn-primary btn-sm"><Plus size={14} /> Novo</Link>
        </div>
      </div>

      <div className="card p-4 flex items-center gap-3">
        <button onClick={() => setDate(d => dayjs(d).subtract(1,'day').format('YYYY-MM-DD'))} className="btn-secondary btn-sm"><ChevronLeft size={14}/></button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-auto text-sm" />
        <button onClick={() => setDate(d => dayjs(d).add(1,'day').format('YYYY-MM-DD'))} className="btn-secondary btn-sm"><ChevronRight size={14}/></button>
        <button onClick={() => setDate(dayjs().format('YYYY-MM-DD'))} className="btn-ghost btn-sm text-xs">Hoje</button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 size={26} className="animate-spin text-blue-500" /></div>
        ) : apts.length === 0 ? (
          <div className="text-center py-20">
            <Calendar size={36} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">Nenhum agendamento</p>
            <p className="text-gray-400 text-sm">{dayjs(date).format('DD/MM/YYYY')}</p>
            <Link to="/appointments/new" className="btn-primary inline-flex mt-4 btn-sm"><Plus size={13}/> Criar</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Horário</th><th>Paciente</th><th>Médico</th><th>Tipo</th><th>Sala</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                {apts.map(apt => (
                  <tr key={apt.id}>
                    <td className="font-mono font-semibold whitespace-nowrap">
                      {dayjs(apt.scheduledAt).format('HH:mm')}
                      <span className="text-xs text-gray-400 ml-1">{apt.durationMinutes}min</span>
                    </td>
                    <td><Link to={'/patients/' + apt.patientId} className="font-medium text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>{apt.patientName}</Link></td>
                    <td className="text-gray-600">{apt.doctorName}</td>
                    <td><span className="badge bg-gray-100 text-gray-600 text-xs">{APPOINTMENT_TYPE_LABEL[apt.appointmentType]}</span></td>
                    <td className="text-gray-400 text-xs">{apt.roomName || '—'}</td>
                    <td><span className={`badge text-xs ${APPOINTMENT_STATUS_COLOR[apt.status]}`}>{APPOINTMENT_STATUS_LABEL[apt.status]}</span></td>
                    <td>
                      <div className="flex items-center gap-1">
                        {apt.status === 'SCHEDULED' && (
                          <button onClick={() => confirm.mutate(apt.id)} className="btn-ghost btn-sm text-green-600 hover:bg-green-50" title="Confirmar"><Check size={14}/></button>
                        )}
                        {!['CANCELLED','COMPLETED','NO_SHOW'].includes(apt.status) && (
                          <button onClick={() => handleCancel(apt.id)} className="btn-ghost btn-sm text-red-500 hover:bg-red-50" title="Cancelar"><X size={14}/></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

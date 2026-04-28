import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import {
  Users, Clock, CheckCircle2, XCircle, Loader2,
  Bell, ClipboardList, Stethoscope, Copy, RefreshCw, Calendar
} from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  INITIAL: 'Inicial', PERIODIC: 'Periódico', DISMISSAL: 'Demissional',
  ASO: 'ASO', FOLLOWUP: 'Acompanhamento', RETURN: 'Retorno',
}

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: 'border-l-blue-400',
  CONFIRMED: 'border-l-green-400',
  IN_PROGRESS: 'border-l-yellow-400',
  COMPLETED: 'border-l-gray-300',
  CANCELLED: 'border-l-red-300',
  NO_SHOW: 'border-l-orange-300',
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function PatientCard({ apt, onCall, onNoShow, onCheckin }: {
  apt: any
  onCall: (id: string) => void
  onNoShow: (id: string) => void
  onCheckin: (id: string) => void
}) {
  const checkinUrl = `${window.location.origin}/checkin/${apt.id}`

  function copyLink() {
    navigator.clipboard.writeText(checkinUrl)
    toast.success('Link copiado!')
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-100 border-l-4 ${STATUS_COLOR[apt.status]} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
            {apt.patient?.fullName?.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 truncate">{apt.patient?.fullName}</p>
            <p className="text-xs text-gray-400">{apt.doctor?.fullName}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-mono text-sm font-bold text-gray-700">{dayjs(apt.scheduledAt).format('HH:mm')}</p>
          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
            {TYPE_LABELS[apt.appointmentType] || apt.appointmentType}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        {apt.room && (
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
            Sala: {apt.room.name}
          </span>
        )}
        {apt.triage?.id && (
          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Triagem OK</span>
        )}
        {apt.checkedInAt && (
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Check-in feito</span>
        )}
        {apt.triage?.riskFlags?.length > 0 && (
          <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">⚠ Risco</span>
        )}
      </div>

      {apt.status !== 'IN_PROGRESS' && apt.status !== 'COMPLETED' && (
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {!apt.checkedInAt && (
            <button onClick={() => onCheckin(apt.id)} className="btn-secondary btn-sm text-xs">
              <CheckCircle2 size={12} /> Check-in
            </button>
          )}
          <button onClick={() => onCall(apt.id)} className="btn-primary btn-sm text-xs">
            <Bell size={12} /> Chamar
          </button>
          <button onClick={() => onNoShow(apt.id)} className="btn-ghost btn-sm text-xs text-red-500">
            <XCircle size={12} /> Faltou
          </button>
          <button onClick={copyLink} className="btn-ghost btn-sm text-xs text-gray-500">
            <Copy size={12} /> Link
          </button>
          <Link to={`/appointments/${apt.id}`} className="btn-ghost btn-sm text-xs">
            <ClipboardList size={12} /> Ver
          </Link>
        </div>
      )}

      {apt.status === 'IN_PROGRESS' && (
        <div className="flex gap-1.5 mt-3">
          <Link to={`/appointments/${apt.id}/triage`} className="btn-secondary btn-sm text-xs">
            <Stethoscope size={12} /> Triagem
          </Link>
          <Link to={`/appointments/${apt.id}/medical-record`} className="btn-primary btn-sm text-xs">
            <ClipboardList size={12} /> Prontuário
          </Link>
        </div>
      )}
    </div>
  )
}

export default function ReceptionPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reception-queue', date],
    queryFn: () => api.get('/reception/queue', { params: { date } }).then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const { data: statsData } = useQuery({
    queryKey: ['reception-stats'],
    queryFn: () => api.get('/reception/stats').then(r => r.data.data),
    refetchInterval: 15_000,
  })

  const callMut = useMutation({
    mutationFn: (id: string) => api.post(`/reception/call/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reception-queue'] }); toast.success('Paciente chamado!') },
  })

  const noShowMut = useMutation({
    mutationFn: (id: string) => api.post(`/reception/no-show/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reception-queue'] }); toast.success('Marcado como faltou.') },
  })

  const checkinMut = useMutation({
    mutationFn: (id: string) => api.post(`/appointments/${id}/check-in`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reception-queue'] }); toast.success('Check-in realizado!') },
  })

  const queue = data?.queue || { waiting: [], inProgress: [], done: [] }
  const stats = statsData || { total: 0, waiting: 0, inProgress: 0, done: 0, cancelled: 0, noShow: 0 }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1>Recepção</h1>
          <p className="text-gray-500 text-sm">Fila de atendimento em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-auto text-sm" />
          <button onClick={() => { setDate(dayjs().format('YYYY-MM-DD')); refetch() }} className="btn-ghost btn-sm text-xs">
            <Calendar size={14} /> Hoje
          </button>
          <button onClick={() => refetch()} className="btn-secondary btn-sm">
            <RefreshCw size={14} /> Atualizar
          </button>
          <Link to="/reception/templates" className="btn-secondary btn-sm text-xs">Templates</Link>
          <Link to="/reception/chatbot" className="btn-primary btn-sm text-xs">🤖 Chatbot Demo</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Total hoje" value={stats.total} color="bg-blue-500" />
        <StatCard icon={Clock} label="Aguardando" value={stats.waiting} color="bg-amber-500" />
        <StatCard icon={Stethoscope} label="Em atendimento" value={stats.inProgress} color="bg-purple-500" />
        <StatCard icon={CheckCircle2} label="Concluídos" value={stats.done} color="bg-green-500" />
        <StatCard icon={XCircle} label="Cancelados" value={stats.cancelled} color="bg-red-400" />
        <StatCard icon={XCircle} label="Faltas" value={stats.noShow} color="bg-orange-400" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-blue-500" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Aguardando */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <h2 className="font-semibold text-gray-700">Aguardando</h2>
              <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {queue.waiting.length}
              </span>
            </div>
            <div className="space-y-3">
              {queue.waiting.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">Nenhum paciente aguardando</p>
              )}
              {queue.waiting.map((apt: any) => (
                <PatientCard
                  key={apt.id} apt={apt}
                  onCall={id => callMut.mutate(id)}
                  onNoShow={id => noShowMut.mutate(id)}
                  onCheckin={id => checkinMut.mutate(id)}
                />
              ))}
            </div>
          </div>

          {/* Em Atendimento */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
              <h2 className="font-semibold text-gray-700">Em Atendimento</h2>
              <span className="ml-auto text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                {queue.inProgress.length}
              </span>
            </div>
            <div className="space-y-3">
              {queue.inProgress.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">Nenhum em atendimento</p>
              )}
              {queue.inProgress.map((apt: any) => (
                <PatientCard
                  key={apt.id} apt={apt}
                  onCall={id => callMut.mutate(id)}
                  onNoShow={id => noShowMut.mutate(id)}
                  onCheckin={id => checkinMut.mutate(id)}
                />
              ))}
            </div>
          </div>

          {/* Concluídos */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <h2 className="font-semibold text-gray-700">Finalizados</h2>
              <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                {queue.done.length}
              </span>
            </div>
            <div className="space-y-3">
              {queue.done.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">Nenhum finalizado ainda</p>
              )}
              {queue.done.map((apt: any) => (
                <PatientCard
                  key={apt.id} apt={apt}
                  onCall={id => callMut.mutate(id)}
                  onNoShow={id => noShowMut.mutate(id)}
                  onCheckin={id => checkinMut.mutate(id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { appointmentService } from '../../lib/appointments'
import { patientService } from '../../lib/patients'
import { Users, Calendar, CheckCircle, XCircle, Plus, Clock, Loader2 } from 'lucide-react'
import { APPOINTMENT_TYPE_LABEL, APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_COLOR } from '../../types'
import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'
dayjs.locale('pt-br')

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: any; icon: any; color: string; sub?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{label}</p>
        <div className={`p-2 rounded-lg ${color}`}><Icon size={17} className="text-white" /></div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const user = useAuthStore(s => s.user)
  const today = dayjs().format('YYYY-MM-DD')

  const { data: stats } = useQuery({
    queryKey: ['stats', today],
    queryFn: () => appointmentService.getDashboardStats(today),
    refetchInterval: 60_000,
  })

  const { data: todayApts, isLoading } = useQuery({
    queryKey: ['apts-today', today],
    queryFn: () => appointmentService.listByDate(today),
    refetchInterval: 30_000,
  })

  const { data: patients } = useQuery({
    queryKey: ['patients-count'],
    queryFn: () => patientService.list(),
  })

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Olá, {user?.fullName?.split(' ')[0]} 👋</h1>
          <p className="text-gray-500 text-sm mt-0.5 capitalize">{dayjs().format('dddd, D [de] MMMM [de] YYYY')}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/appointments/new" className="btn-primary btn-sm"><Plus size={14} /> Agendar</Link>
          <Link to="/patients/new" className="btn-secondary btn-sm"><Plus size={14} /> Paciente</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Consultas hoje" value={stats?.total} icon={Calendar} color="bg-blue-500" sub={`${stats?.attendanceRate ?? 0}% comparecimento`} />
        <StatCard label="Confirmados" value={stats?.confirmed} icon={CheckCircle} color="bg-green-500" />
        <StatCard label="Cancelados" value={stats?.cancelled} icon={XCircle} color="bg-red-500" />
        <StatCard label="Pacientes ativos" value={patients?.filter(p => p.status === 'ACTIVE').length} icon={Users} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Clock size={14} className="text-blue-500" /> Agenda de Hoje</h2>
            <Link to="/appointments/calendar" className="text-sm text-blue-600 font-medium">Ver calendário →</Link>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
          ) : !todayApts?.length ? (
            <div className="px-6 py-12 text-center">
              <Calendar size={32} className="mx-auto text-gray-200 mb-2" />
              <p className="text-gray-400 text-sm">Nenhum agendamento para hoje</p>
              <Link to="/appointments/new" className="btn-primary btn-sm inline-flex mt-3"><Plus size={13} /> Criar</Link>
            </div>
          ) : todayApts.map(apt => (
            <Link key={apt.id} to={`/appointments/${apt.id}`} className="flex items-center px-5 py-3 border-t border-gray-100 hover:bg-gray-50 transition-colors">
              <div className="w-12 text-center flex-shrink-0">
                <p className="text-sm font-bold text-gray-800">{dayjs(apt.scheduledAt).format('HH:mm')}</p>
                <p className="text-xs text-gray-400">{apt.durationMinutes}min</p>
              </div>
              <div className="ml-4 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{apt.patientName}</p>
                <p className="text-xs text-gray-400">{APPOINTMENT_TYPE_LABEL[apt.appointmentType]} · {apt.doctorName}</p>
              </div>
              <span className={`badge text-xs ${APPOINTMENT_STATUS_COLOR[apt.status]}`}>
                {APPOINTMENT_STATUS_LABEL[apt.status]}
              </span>
            </Link>
          ))}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Ações rápidas</p>
            <div className="space-y-2">
              {[
                { to: '/appointments/new', label: 'Novo agendamento', icon: Calendar, cls: 'text-blue-600 bg-blue-50' },
                { to: '/patients/new',     label: 'Novo paciente',    icon: Users,    cls: 'text-purple-600 bg-purple-50' },
                { to: '/appointments',     label: 'Ver agenda',       icon: Clock,    cls: 'text-green-600 bg-green-50' },
              ].map(item => (
                <Link key={item.to} to={item.to} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors">
                  <div className={`p-1.5 rounded-md ${item.cls}`}><item.icon size={13} /></div>
                  <span className="text-sm text-gray-700">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Resumo do dia</p>
            <div className="space-y-2.5">
              <div className="flex justify-between"><span className="text-xs text-gray-500">Total</span><span className="text-sm font-semibold">{stats?.total ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-xs text-gray-500">Concluídos</span><span className="text-sm font-semibold text-green-600">{stats?.completed ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-xs text-gray-500">Cancelados</span><span className="text-sm font-semibold text-red-500">{stats?.cancelled ?? '—'}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

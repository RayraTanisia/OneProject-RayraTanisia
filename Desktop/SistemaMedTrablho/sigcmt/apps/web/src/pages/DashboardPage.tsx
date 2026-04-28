import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'
import { Link } from 'react-router-dom'
import { Users, Calendar, CheckCircle, XCircle, TrendingUp, Plus, Clock } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'
dayjs.locale('pt-br')

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: any; color: string; sub?: string }) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const user = useAuthStore(s => s.user)
  const today = dayjs().format('dddd, D [de] MMMM [de] YYYY')

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/appointments/stats').then(r => r.data.data),
    refetchInterval: 60_000,
  })

  const { data: todayApts } = useQuery({
    queryKey: ['appointments-today'],
    queryFn: () => api.get('/appointments', { params: { date: dayjs().format('YYYY-MM-DD'), limit: 8 } }).then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const statusColor: Record<string, string> = {
    SCHEDULED: 'bg-blue-100 text-blue-700',
    CONFIRMED: 'bg-green-100 text-green-700',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-gray-100 text-gray-600',
    CANCELLED: 'bg-red-100 text-red-600',
    NO_SHOW: 'bg-orange-100 text-orange-700',
  }
  const statusLabel: Record<string, string> = {
    SCHEDULED: 'Agendado', CONFIRMED: 'Confirmado', IN_PROGRESS: 'Em andamento',
    COMPLETED: 'Concluído', CANCELLED: 'Cancelado', NO_SHOW: 'Faltou',
  }
  const typeLabel: Record<string, string> = {
    INITIAL: 'Inicial', PERIODIC: 'Periódico', DISMISSAL: 'Demissional',
    ASO: 'ASO', FOLLOWUP: 'Acompanhamento', RETURN: 'Retorno',
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Olá, {user?.fullName.split(' ')[0]} 👋</h1>
          <p className="text-gray-500 text-sm mt-1 capitalize">{today}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/appointments/new" className="btn-primary btn-sm">
            <Plus size={14} /> Agendar
          </Link>
          <Link to="/patients/new" className="btn-secondary btn-sm">
            <Plus size={14} /> Paciente
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Consultas hoje" value={stats?.today.total ?? '—'} icon={Calendar} color="bg-blue-500" sub={`${stats?.today.attendanceRate ?? 0}% de comparecimento`} />
        <StatCard label="Confirmados" value={stats?.today.confirmed ?? '—'} icon={CheckCircle} color="bg-green-500" />
        <StatCard label="Cancelados hoje" value={stats?.today.cancelled ?? '—'} icon={XCircle} color="bg-red-500" />
        <StatCard label="Pacientes ativos" value={stats?.totals.activePatients ?? '—'} icon={Users} color="bg-purple-500" sub={`+${stats?.month.newPatients ?? 0} este mês`} />
      </div>

      {/* Agenda do dia + atalhos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agenda hoje */}
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Clock size={16} className="text-blue-500" /> Agenda de Hoje
            </h2>
            <Link to="/appointments/calendar" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Ver calendário →
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {!todayApts?.length ? (
              <div className="px-6 py-10 text-center">
                <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-400 text-sm">Nenhum agendamento para hoje</p>
                <Link to="/appointments/new" className="btn-primary btn-sm mt-3 inline-flex">
                  <Plus size={14} /> Criar agendamento
                </Link>
              </div>
            ) : todayApts.map((apt: any) => (
              <Link key={apt.id} to={`/appointments/${apt.id}`} className="flex items-center px-6 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="w-14 text-center flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">{dayjs(apt.scheduledAt).format('HH:mm')}</p>
                  <p className="text-xs text-gray-400">{apt.durationMinutes}min</p>
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{apt.patient?.fullName}</p>
                  <p className="text-xs text-gray-400">{typeLabel[apt.appointmentType]} · Dr. {apt.doctor?.fullName?.split(' ').slice(-1)}</p>
                </div>
                <span className={`ml-2 badge text-xs ${statusColor[apt.status] || 'bg-gray-100 text-gray-600'}`}>
                  {statusLabel[apt.status] || apt.status}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Atalhos rápidos */}
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Ações rápidas</h3>
            <div className="space-y-2">
              {[
                { to: '/appointments/new', label: 'Novo agendamento', icon: Calendar, color: 'text-blue-600 bg-blue-50' },
                { to: '/patients/new', label: 'Novo paciente', icon: Users, color: 'text-purple-600 bg-purple-50' },
                { to: '/appointments', label: 'Ver todos agendamentos', icon: TrendingUp, color: 'text-green-600 bg-green-50' },
              ].map(item => (
                <Link key={item.to} to={item.to} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                  <div className={`p-1.5 rounded-md ${item.color}`}>
                    <item.icon size={14} />
                  </div>
                  <span className="text-sm text-gray-700">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Mês atual</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Total de consultas</span>
                <span className="text-sm font-semibold text-gray-800">{stats?.month.totalAppointments ?? '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Novos pacientes</span>
                <span className="text-sm font-semibold text-green-600">+{stats?.month.newPatients ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Users, Building2, FileText, Calendar,
  TrendingUp, Activity, UserCheck, UserX, Stethoscope, Download
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Overview {
  totals: { patients: number; companies: number; asos: number; today: number }
  monthly: { label: string; total: number; completed: number; cancelled: number }[]
  patientGrowth: { label: string; new: number }[]
  typeBreakdown: { type: string; count: number }[]
  topCompanies: { companyId: string; name: string; count: number }[]
  topDoctors: { doctorId: string; name: string; crm: string; count: number }[]
  asoStats: { label: string; total: number }[]
  attendance: { completedCount: number; noShowCount: number; totalInPeriod: number; attendanceRate: number; noShowRate: number }
}

const TYPE_LABELS: Record<string, string> = {
  INITIAL: 'Inicial', PERIODIC: 'Periódica', DISMISSAL: 'Demissional',
  ASO: 'ASO', FOLLOWUP: 'Retorno', RETURN: 'Acompanhamento',
}

const PIE_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa']

const PERIOD_OPTIONS = [
  { label: '3 meses', value: '3' },
  { label: '6 meses', value: '6' },
  { label: '12 meses', value: '12' },
]

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color} flex-shrink-0`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [months, setMonths] = useState('6')
  const [exporting, setExporting] = useState(false)

  const { data: overview, isLoading } = useQuery<Overview>({
    queryKey: ['reports-overview', months],
    queryFn: () => api.get('/reports/overview', { params: { months } }).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  })

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/appointments/export', {
        responseType: 'blob',
        params: {
          startDate: new Date(Date.now() - Number(months) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          endDate: new Date().toISOString().slice(0, 10),
        },
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-${months}meses.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Erro ao exportar.')
    } finally {
      setExporting(false)
    }
  }

  if (isLoading || !overview) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1>Relatórios</h1>
          <p className="text-sm text-gray-500 mt-1">Visão geral da clínica</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setMonths(opt.value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  months === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={handleExport} disabled={exporting} className="btn-secondary btn-sm">
            <Download size={14} /> {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
        </div>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Pacientes ativos" value={overview.totals.patients} color="bg-indigo-500" />
        <StatCard icon={Building2} label="Empresas ativas" value={overview.totals.companies} color="bg-cyan-500" />
        <StatCard icon={FileText} label="ASOs emitidos" value={overview.totals.asos} color="bg-emerald-500" />
        <StatCard icon={Calendar} label="Consultas hoje" value={overview.totals.today} color="bg-amber-500" />
      </div>

      {/* Cards de presença */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={UserCheck}
          label="Taxa de presença"
          value={`${overview.attendance.attendanceRate}%`}
          sub={`${overview.attendance.completedCount} de ${overview.attendance.totalInPeriod} consultas`}
          color="bg-green-500"
        />
        <StatCard
          icon={UserX}
          label="Taxa de falta"
          value={`${overview.attendance.noShowRate}%`}
          sub={`${overview.attendance.noShowCount} faltas no período`}
          color="bg-red-500"
        />
        <StatCard
          icon={Activity}
          label="Total no período"
          value={overview.attendance.totalInPeriod}
          sub={`Últimos ${months} meses`}
          color="bg-purple-500"
        />
      </div>

      {/* Agendamentos por mês + Crescimento de pacientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold text-gray-800">Agendamentos por mês</h2>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={overview.monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" name="Total" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Concluídos" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cancelled" name="Cancelados" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <h2 className="font-semibold text-gray-800">Novos pacientes por mês</h2>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={overview.patientGrowth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="new" name="Novos" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tipos de consulta + ASOs por mês */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Tipos de consulta no período</h2>
          {overview.typeBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sem dados no período</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={overview.typeBreakdown} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80}>
                    {overview.typeBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, TYPE_LABELS[n as string] || n]} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-2 flex-1">
                {overview.typeBreakdown.map((t, i) => (
                  <li key={t.type} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-gray-600 flex-1">{TYPE_LABELS[t.type] || t.type}</span>
                    <span className="font-semibold text-gray-800">{t.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-gray-800">ASOs emitidos por mês</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={overview.asoStats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" name="ASOs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top empresas + Top médicos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {overview.topCompanies.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-cyan-500" />
              <h2 className="font-semibold text-gray-800">Top empresas por consultas</h2>
            </div>
            <div className="space-y-3">
              {overview.topCompanies.map((c, i) => {
                const max = overview.topCompanies[0].count
                const pct = Math.round((c.count / max) * 100)
                return (
                  <div key={c.companyId} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400 w-5 text-center">{i + 1}</span>
                    <span className="text-sm text-gray-700 w-40 truncate">{c.name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-cyan-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-800 w-8 text-right">{c.count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {overview.topDoctors.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Stethoscope className="w-5 h-5 text-indigo-500" />
              <h2 className="font-semibold text-gray-800">Top médicos por consultas</h2>
            </div>
            <div className="space-y-3">
              {overview.topDoctors.map((d, i) => {
                const max = overview.topDoctors[0].count
                const pct = Math.round((d.count / max) * 100)
                return (
                  <div key={d.doctorId} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400 w-5 text-center">{i + 1}</span>
                    <div className="w-40">
                      <p className="text-sm text-gray-700 truncate">{d.name}</p>
                      {d.crm && <p className="text-xs text-gray-400">CRM {d.crm}</p>}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-800 w-8 text-right">{d.count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

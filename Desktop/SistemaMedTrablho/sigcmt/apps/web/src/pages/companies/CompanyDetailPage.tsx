import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Edit, Building2, Phone, Mail, MapPin, Users,
  Calendar, Loader2, Plus, ShieldAlert, BadgeInfo
} from 'lucide-react'
import dayjs from 'dayjs'

const statusColor: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  PROSPECT: 'bg-yellow-50 text-yellow-700',
}
const statusLabel: Record<string, string> = { ACTIVE: 'Ativa', INACTIVE: 'Inativa', PROSPECT: 'Prospecto' }
const riskColor: Record<number, string> = {
  1: 'bg-green-100 text-green-700', 2: 'bg-yellow-100 text-yellow-700',
  3: 'bg-orange-100 text-orange-700', 4: 'bg-red-100 text-red-700',
}
const riskLabel: Record<number, string> = { 1: 'Grau 1 — Baixo', 2: 'Grau 2 — Médio', 3: 'Grau 3 — Alto', 4: 'Grau 4 — Crítico' }
const aptTypeLabel: Record<string, string> = {
  INITIAL: 'Inicial', PERIODIC: 'Periódico', DISMISSAL: 'Demissional',
  ASO: 'ASO', FOLLOWUP: 'Acompanhamento', RETURN: 'Retorno',
}
const aptStatusColor: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700', CONFIRMED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-600', CANCELLED: 'bg-red-100 text-red-600',
}
const aptStatusLabel: Record<string, string> = {
  SCHEDULED: 'Agendado', CONFIRMED: 'Confirmado', COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado', NO_SHOW: 'Faltou', IN_PROGRESS: 'Em andamento',
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700">{value || <span className="text-gray-300">—</span>}</span>
    </div>
  )
}

export default function CompanyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => api.get(`/companies/${id}`).then(r => r.data.data),
  })

  const deactivateMut = useMutation({
    mutationFn: () => api.delete(`/companies/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      toast.success('Empresa desativada.')
      navigate('/companies')
    },
  })

  if (isLoading) return (
    <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
  )
  if (!company) return <div className="text-center py-20 text-gray-400">Empresa não encontrada.</div>

  const addr = company.address as any
  const addrStr = addr ? [addr.street, addr.number, addr.neighborhood, addr.city, addr.state].filter(Boolean).join(', ') : null

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost btn-sm"><ArrowLeft size={16} /></button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{company.tradeName || company.legalName}</h1>
              {company.tradeName && <p className="text-sm text-gray-500">{company.legalName}</p>}
              <div className="flex items-center gap-2 mt-1">
                <span className={`badge text-xs ${statusColor[company.status]}`}>
                  {statusLabel[company.status]}
                </span>
                <span className={`badge text-xs ${riskColor[company.riskLevel]}`}>
                  {riskLabel[company.riskLevel]}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/companies/${id}/edit`} className="btn-secondary btn-sm">
            <Edit size={14} /> Editar
          </Link>
          {company.status !== 'INACTIVE' && (
            <button
              onClick={() => { if (confirm('Desativar esta empresa?')) deactivateMut.mutate() }}
              className="btn-ghost btn-sm text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              Desativar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <BadgeInfo size={14} className="text-blue-500" /> Dados Cadastrais
              </h2>
            </div>
            <div className="card-body">
              <InfoRow label="CNPJ" value={company.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')} />
              <InfoRow label="CNAE" value={company.cnae} />
              <InfoRow label="Setor" value={company.sector} />
              <InfoRow label="Funcionários" value={company.employeeCount ? `${company.employeeCount} colaboradores` : null} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Phone size={14} className="text-blue-500" /> Contato
              </h2>
            </div>
            <div className="card-body">
              <InfoRow label="Telefone" value={company.phone} />
              <InfoRow label="E-mail" value={company.email} />
              {addrStr && (
                <div className="flex items-start gap-2 py-2">
                  <span className="text-xs text-gray-400 w-32 flex-shrink-0 pt-0.5">Endereço</span>
                  <span className="text-sm text-gray-700">{addrStr}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">{company._count?.patients ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">Pacientes</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">{company._count?.appointments ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">Consultas</p>
            </div>
          </div>
        </div>

        {/* Coluna direita */}
        <div className="lg:col-span-2 space-y-4">
          {/* Funcionários */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Users size={14} className="text-blue-500" /> Funcionários Cadastrados
              </h2>
              <Link to={`/patients/new`} className="btn-primary btn-sm">
                <Plus size={12} /> Novo paciente
              </Link>
            </div>
            <div>
              {!company.patients?.length ? (
                <div className="px-6 py-10 text-center">
                  <Users size={28} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">Nenhum funcionário cadastrado</p>
                </div>
              ) : company.patients.map((p: any) => (
                <Link key={p.id} to={`/patients/${p.id}`}
                  className="flex items-center gap-4 px-6 py-3 border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                    {p.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{p.fullName}</p>
                    <p className="text-xs text-gray-400">{p.currentJobTitle || 'Cargo não informado'}</p>
                  </div>
                  <span className={`badge text-xs ${p.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Consultas recentes */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Calendar size={14} className="text-blue-500" /> Consultas Recentes
              </h2>
              <Link to={`/appointments/new`} className="btn-primary btn-sm">
                <Plus size={12} /> Agendar
              </Link>
            </div>
            <div>
              {!company.appointments?.length ? (
                <div className="px-6 py-10 text-center">
                  <Calendar size={28} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">Nenhuma consulta registrada</p>
                </div>
              ) : company.appointments.map((apt: any) => (
                <Link key={apt.id} to={`/appointments/${apt.id}`}
                  className="flex items-center gap-4 px-6 py-3 border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-center w-12 flex-shrink-0">
                    <p className="text-sm font-bold text-gray-800">{dayjs(apt.scheduledAt).format('DD/MM')}</p>
                    <p className="text-xs text-gray-400">{dayjs(apt.scheduledAt).format('YYYY')}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{apt.patient?.fullName}</p>
                    <p className="text-xs text-gray-400">{aptTypeLabel[apt.appointmentType]} · Dr. {apt.doctor?.fullName}</p>
                  </div>
                  <span className={`badge text-xs ${aptStatusColor[apt.status] || 'bg-gray-100 text-gray-600'}`}>
                    {aptStatusLabel[apt.status] || apt.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Plus, Calendar, Loader2, Check, X, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'

const statusColor: Record<string, string> = {
  SCHEDULED:'bg-blue-50 text-blue-700', CONFIRMED:'bg-green-50 text-green-700',
  IN_PROGRESS:'bg-yellow-50 text-yellow-700', COMPLETED:'bg-gray-100 text-gray-600',
  CANCELLED:'bg-red-50 text-red-600', NO_SHOW:'bg-orange-50 text-orange-700'
}
const statusLabel: Record<string, string> = {
  SCHEDULED:'Agendado', CONFIRMED:'Confirmado', IN_PROGRESS:'Em andamento',
  COMPLETED:'Concluído', CANCELLED:'Cancelado', NO_SHOW:'Faltou'
}
const typeLabel: Record<string, string> = {
  INITIAL:'Inicial', PERIODIC:'Periódico', DISMISSAL:'Demissional', ASO:'ASO', FOLLOWUP:'Acompanhamento', RETURN:'Retorno'
}

export default function AppointmentListPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const qc = useQueryClient()
  const limit = 30

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/appointments/export', {
        responseType: 'blob',
        params: { startDate: date, endDate: date, status: statusFilter || undefined },
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `agendamentos-${date}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Erro ao exportar.')
    } finally {
      setExporting(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', date, statusFilter, page],
    queryFn: () => api.get('/appointments', { params: { date, status: statusFilter || undefined, page, limit } }).then(r => r.data),
    refetchInterval: 30_000,
  })

  const confirmMut = useMutation({
    mutationFn: (id: string) => api.post(`/appointments/${id}/confirm`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments'] }); toast.success('Confirmado!') },
  })

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/appointments/${id}/cancel`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments'] }); toast.success('Cancelado.') },
  })

  const apts = data?.data || []
  const meta = data?.meta || {}

  function handleCancel(id: string) {
    const reason = prompt('Motivo do cancelamento:')
    if (!reason || reason.trim().length < 3) return
    cancelMut.mutate({ id, reason })
  }

  function prevDay() { setDate(d => dayjs(d).subtract(1, 'day').format('YYYY-MM-DD')); setPage(1) }
  function nextDay() { setDate(d => dayjs(d).add(1, 'day').format('YYYY-MM-DD')); setPage(1) }
  function goToday() { setDate(dayjs().format('YYYY-MM-DD')); setPage(1) }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1>Agendamentos</h1>
          <p className="text-gray-500 text-sm mt-0.5">{meta.total ?? 0} no dia selecionado</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} disabled={exporting} className="btn-secondary btn-sm">
            <Download size={14} /> {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
          <Link to="/appointments/calendar" className="btn-secondary btn-sm"><Calendar size={14} /> Calendário</Link>
          <Link to="/appointments/new" className="btn-primary btn-sm"><Plus size={14} /> Novo</Link>
        </div>
      </div>

      {/* Controles */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        {/* Navegação de data */}
        <div className="flex items-center gap-2">
          <button onClick={prevDay} className="btn-secondary btn-sm"><ChevronLeft size={14} /></button>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1) }} className="input w-auto text-sm" />
          <button onClick={nextDay} className="btn-secondary btn-sm"><ChevronRight size={14} /></button>
          <button onClick={goToday} className="btn-ghost btn-sm text-xs">Hoje</button>
        </div>
        {/* Status filter */}
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="input w-auto text-sm">
          <option value="">Todos os status</option>
          {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
        ) : apts.length === 0 ? (
          <div className="text-center py-20">
            <Calendar size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">Nenhum agendamento</p>
            <p className="text-gray-400 text-sm mt-1">para {dayjs(date).format('DD/MM/YYYY')}</p>
            <Link to="/appointments/new" className="btn-primary inline-flex mt-4 btn-sm"><Plus size={14} /> Criar agendamento</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Horário</th><th>Paciente</th><th>Médico</th><th>Tipo</th><th>Sala</th><th>Status</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {apts.map((apt: any) => (
                  <tr key={apt.id}>
                    <td className="font-mono font-medium text-gray-800 whitespace-nowrap">
                      {dayjs(apt.scheduledAt).format('HH:mm')}
                      <span className="text-xs text-gray-400 ml-1">{apt.durationMinutes}min</span>
                    </td>
                    <td>
                      <Link to={`/patients/${apt.patientId}`} className="font-medium text-blue-600 hover:text-blue-700 hover:underline">
                        {apt.patient?.fullName}
                      </Link>
                    </td>
                    <td className="text-gray-600">{apt.doctor?.fullName}</td>
                    <td><span className="badge bg-gray-100 text-gray-600 text-xs">{typeLabel[apt.appointmentType]}</span></td>
                    <td className="text-gray-500 text-xs">{apt.room?.name || '—'}</td>
                    <td>
                      <span className={`badge text-xs ${statusColor[apt.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabel[apt.status] || apt.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {apt.status === 'SCHEDULED' && (
                          <button onClick={() => confirmMut.mutate(apt.id)} className="btn-ghost btn-sm text-green-600 hover:text-green-700 hover:bg-green-50" title="Confirmar">
                            <Check size={14} />
                          </button>
                        )}
                        {!['CANCELLED','COMPLETED','NO_SHOW'].includes(apt.status) && (
                          <button onClick={() => handleCancel(apt.id)} className="btn-ghost btn-sm text-red-500 hover:text-red-600 hover:bg-red-50" title="Cancelar">
                            <X size={14} />
                          </button>
                        )}
                        <Link to={`/appointments/${apt.id}`} className="btn-ghost btn-sm text-xs">Ver</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Página {page} de {meta.totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p-1)} className="btn-secondary btn-sm"><ChevronLeft size={14}/></button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage(p => p+1)} className="btn-secondary btn-sm"><ChevronRight size={14}/></button>
          </div>
        </div>
      )}
    </div>
  )
}

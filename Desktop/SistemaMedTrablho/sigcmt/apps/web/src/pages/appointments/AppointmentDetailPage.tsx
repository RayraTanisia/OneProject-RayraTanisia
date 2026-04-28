import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Loader2, User, Clock,
  CheckCircle, XCircle, Play, Flag, Edit, Save, Stethoscope
} from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'
dayjs.locale('pt-br')

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
  INITIAL: 'Consulta Inicial', PERIODIC: 'Periódico', DISMISSAL: 'Demissional',
  ASO: 'ASO', FOLLOWUP: 'Acompanhamento', RETURN: 'Retorno',
}

export default function AppointmentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [notes, setNotes] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)

  const { data: apt, isLoading } = useQuery<any>({
    queryKey: ['appointment', id],
    queryFn: () => api.get(`/appointments/${id}`).then(r => r.data.data),
  })

  useEffect(() => {
    if (apt?.notes) setNotes(apt.notes)
  }, [apt?.id])

  const confirmMut = useMutation({
    mutationFn: () => api.post(`/appointments/${id}/confirm`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointment', id] }); toast.success('Agendamento confirmado!') },
  })

  const checkInMut = useMutation({
    mutationFn: () => api.post(`/appointments/${id}/check-in`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointment', id] }); toast.success('Check-in realizado!') },
  })

  const startMut = useMutation({
    mutationFn: () => api.put(`/appointments/${id}`, { status: 'IN_PROGRESS' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointment', id] }); toast.success('Consulta iniciada!') },
  })

  const completeMut = useMutation({
    mutationFn: () => api.put(`/appointments/${id}`, { status: 'COMPLETED', notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointment', id] })
      qc.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Consulta concluída!')
      setEditingNotes(false)
    },
  })

  const noShowMut = useMutation({
    mutationFn: () => api.put(`/appointments/${id}`, { status: 'NO_SHOW' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointment', id] }); toast.success('Marcado como faltou.') },
  })

  const cancelMut = useMutation({
    mutationFn: (reason: string) => api.post(`/appointments/${id}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointment', id] })
      qc.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Agendamento cancelado.')
    },
  })

  const saveNotesMut = useMutation({
    mutationFn: () => api.put(`/appointments/${id}`, { notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointment', id] }); toast.success('Observações salvas!'); setEditingNotes(false) },
  })

  function handleCancel() {
    const reason = prompt('Motivo do cancelamento:')
    if (!reason || reason.trim().length < 3) return
    cancelMut.mutate(reason)
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
  )
  if (!apt) return <div className="text-center py-20 text-gray-400">Agendamento não encontrado.</div>

  const isDone = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(apt.status)
  const patientAge = apt.patient?.birthDate ? dayjs().diff(dayjs(apt.patient.birthDate), 'year') : null

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost btn-sm"><ArrowLeft size={16} /></button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{typeLabel[apt.appointmentType] || apt.appointmentType}</h1>
              <span className={`badge text-xs ${statusColor[apt.status]}`}>{statusLabel[apt.status]}</span>
            </div>
            <p className="text-gray-500 text-sm mt-0.5 capitalize">
              {dayjs(apt.scheduledAt).format('dddd, D [de] MMMM [de] YYYY [às] HH:mm')}
            </p>
          </div>
        </div>

        {/* Botões de ação */}
        {!isDone && (
          <div className="flex gap-2 flex-wrap">
            {apt.status === 'SCHEDULED' && (
              <>
                <button onClick={() => confirmMut.mutate()} disabled={confirmMut.isPending} className="btn-primary btn-sm">
                  <CheckCircle size={14} /> Confirmar
                </button>
                <button onClick={() => checkInMut.mutate()} disabled={checkInMut.isPending} className="btn-secondary btn-sm">
                  Check-in
                </button>
              </>
            )}
            {apt.status === 'CONFIRMED' && (
              <>
                <button onClick={() => navigate(`/appointments/${id}/triage`)} className="btn-secondary btn-sm">
                  <Stethoscope size={14} /> Triagem
                </button>
                <button onClick={() => startMut.mutate()} disabled={startMut.isPending} className="btn-primary btn-sm">
                  <Play size={14} /> Iniciar consulta
                </button>
              </>
            )}
            {apt.status === 'IN_PROGRESS' && (
              <>
                <button onClick={() => navigate(`/appointments/${id}/medical-record`)} className="btn-secondary btn-sm">
                  <Edit size={14} /> Prontuário
                </button>
                <button onClick={() => completeMut.mutate()} disabled={completeMut.isPending} className="btn-primary btn-sm">
                  <Flag size={14} /> Concluir
                </button>
              </>
            )}
            {apt.status === 'SCHEDULED' && (
              <button onClick={() => noShowMut.mutate()} disabled={noShowMut.isPending} className="btn-ghost btn-sm text-orange-600 hover:bg-orange-50">
                Faltou
              </button>
            )}
            <button onClick={handleCancel} disabled={cancelMut.isPending} className="btn-ghost btn-sm text-red-500 hover:bg-red-50">
              <XCircle size={14} /> Cancelar
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda */}
        <div className="space-y-4">
          {/* Paciente */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <User size={14} className="text-blue-500" /> Paciente
              </h2>
            </div>
            <div className="card-body">
              <Link to={`/patients/${apt.patient?.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
                  {apt.patient?.fullName?.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-800">{apt.patient?.fullName}</p>
                  {patientAge && <p className="text-xs text-gray-400">{patientAge} anos</p>}
                </div>
              </Link>
              {Array.isArray(apt.patient?.allergies) && apt.patient.allergies.length > 0 && (
                <div className="mt-3 p-2 bg-red-50 rounded-lg">
                  <p className="text-xs font-semibold text-red-700 mb-1">Alergias</p>
                  <div className="flex flex-wrap gap-1">
                    {apt.patient.allergies.map((a: any, i: number) => (
                      <span key={i} className="badge bg-red-100 text-red-700 text-xs">{a.substance}</span>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(apt.patient?.continuousMedications) && apt.patient.continuousMedications.length > 0 && (
                <div className="mt-2 p-2 bg-yellow-50 rounded-lg">
                  <p className="text-xs font-semibold text-yellow-700 mb-1">Uso contínuo</p>
                  {apt.patient.continuousMedications.map((m: any, i: number) => (
                    <p key={i} className="text-xs text-yellow-800">{m.name} {m.dosage ? `— ${m.dosage}` : ''}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Detalhes */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Clock size={14} className="text-blue-500" /> Detalhes
              </h2>
            </div>
            <div className="card-body space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Médico</span>
                <span className="font-medium text-gray-700">Dr. {apt.doctor?.fullName}</span>
              </div>
              {apt.doctor?.crmNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-400">CRM</span>
                  <span className="text-gray-600">{apt.doctor.crmNumber}/{apt.doctor.crmState}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Duração</span>
                <span className="text-gray-600">{apt.durationMinutes} minutos</span>
              </div>
              {apt.room && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Sala</span>
                  <span className="text-gray-600">{apt.room.name}</span>
                </div>
              )}
              {apt.company && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Empresa</span>
                  <Link to={`/companies/${apt.company.id}`} className="text-blue-600 hover:underline text-sm">
                    {apt.company.tradeName || apt.company.legalName}
                  </Link>
                </div>
              )}
              {apt.confirmedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Confirmado</span>
                  <span className="text-gray-600">{dayjs(apt.confirmedAt).format('DD/MM HH:mm')}</span>
                </div>
              )}
              {apt.checkedInAt && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Check-in</span>
                  <span className="text-gray-600">{dayjs(apt.checkedInAt).format('DD/MM HH:mm')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna direita */}
        <div className="lg:col-span-2 space-y-4">
          {/* Prontuário / Observações */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Edit size={14} className="text-blue-500" /> Observações / Prontuário
              </h2>
              {!isDone && !editingNotes && (
                <button onClick={() => setEditingNotes(true)} className="btn-ghost btn-sm text-blue-600">
                  <Edit size={12} /> Editar
                </button>
              )}
            </div>
            <div className="card-body">
              {editingNotes || apt.status === 'IN_PROGRESS' ? (
                <div className="space-y-3">
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="input min-h-[160px] font-mono text-sm"
                    placeholder="Registre aqui as observações clínicas, anamnese, diagnóstico, conduta..."
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingNotes(false)} className="btn-secondary btn-sm">Cancelar</button>
                    <button onClick={() => saveNotesMut.mutate()} disabled={saveNotesMut.isPending} className="btn-primary btn-sm">
                      {saveNotesMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
                    </button>
                  </div>
                </div>
              ) : apt.notes ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{apt.notes}</p>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">
                  {isDone ? 'Nenhuma observação registrada.' : 'Clique em "Editar" para adicionar observações.'}
                </p>
              )}
            </div>
          </div>

          {/* Triagem */}
          {apt.triage && (
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2"><Stethoscope size={14} className="text-indigo-500" /> Triagem</h2>
                {!isDone && (
                  <button onClick={() => navigate(`/appointments/${id}/triage`)} className="btn-ghost btn-sm text-indigo-600">
                    <Edit size={12} /> Editar
                  </button>
                )}
              </div>
              <div className="card-body">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`badge text-xs ${apt.triage.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {apt.triage.status === 'COMPLETED' ? 'Concluída' : 'Pendente'}
                  </span>
                </div>
                {/* Sinais vitais */}
                {Array.isArray(apt.triage.responses) && apt.triage.responses.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    {apt.triage.responses.filter((r: any) => r.key !== 'queixa').map((r: any) => (
                      <div key={r.key} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-gray-400">{r.label}</p>
                        <p className="text-sm font-semibold text-gray-800">{r.value}</p>
                      </div>
                    ))}
                  </div>
                )}
                {/* Queixa principal */}
                {apt.triage.responses?.find((r: any) => r.key === 'queixa')?.value && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-1">Queixa Principal</p>
                    <p className="text-sm text-gray-700">{apt.triage.responses.find((r: any) => r.key === 'queixa').value}</p>
                  </div>
                )}
                {/* Sintomas */}
                {Array.isArray(apt.triage.currentSymptoms) && apt.triage.currentSymptoms.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-1">Sintomas</p>
                    <div className="flex flex-wrap gap-1">
                      {apt.triage.currentSymptoms.map((s: string, i: number) => (
                        <span key={i} className="badge bg-orange-100 text-orange-700 text-xs">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Flags de risco */}
                {Array.isArray(apt.triage.riskFlags) && apt.triage.riskFlags.length > 0 && (
                  <div className="mb-3 p-2 bg-red-50 rounded-lg">
                    <p className="text-xs font-semibold text-red-700 mb-1">Fatores de risco detectados</p>
                    <div className="flex flex-wrap gap-1">
                      {apt.triage.riskFlags.map((f: string, i: number) => (
                        <span key={i} className="badge bg-red-100 text-red-700 text-xs">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {apt.triage.doctorNotes && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Observações da triagem</p>
                    <p className="text-sm text-gray-700">{apt.triage.doctorNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prontuário */}
          {apt.notes && (() => {
            try {
              const rec = JSON.parse(apt.notes)
              if (rec._type !== 'medical_record') return null
              return (
                <div className="card">
                  <div className="card-header flex items-center justify-between">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <Edit size={14} className="text-indigo-500" /> Prontuário
                      <span className={`badge text-xs ${rec.status === 'finalized' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {rec.status === 'finalized' ? 'Finalizado' : 'Rascunho'}
                      </span>
                    </h2>
                    {!isDone && (
                      <button onClick={() => navigate(`/appointments/${id}/medical-record`)} className="btn-ghost btn-sm text-indigo-600">
                        <Edit size={12} /> Editar
                      </button>
                    )}
                  </div>
                  <div className="card-body space-y-3 text-sm">
                    {rec.chiefComplaint && (
                      <div><p className="text-xs text-gray-400 mb-1">Queixa Principal</p><p className="text-gray-700">{rec.chiefComplaint}</p></div>
                    )}
                    {rec.diagnoses?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Diagnósticos</p>
                        <div className="flex flex-wrap gap-1">
                          {rec.diagnoses.map((d: any, i: number) => (
                            <span key={i} className={`badge text-xs ${d.type === 'primary' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                              {d.cid10} — {d.description}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {rec.prescriptions?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Prescrição</p>
                        {rec.prescriptions.map((p: any, i: number) => (
                          <p key={i} className="text-gray-700">{p.drug} {p.dosage} — {p.frequency} por {p.days} dias</p>
                        ))}
                      </div>
                    )}
                    {rec.workLeave?.active && (
                      <div className="p-2 bg-amber-50 rounded-lg">
                        <p className="text-xs font-semibold text-amber-700">Afastamento: {rec.workLeave.days} dia(s) a partir de {rec.workLeave.startDate}</p>
                        {rec.workLeave.reason && <p className="text-xs text-amber-600 mt-0.5">{rec.workLeave.reason}</p>}
                      </div>
                    )}
                    {rec.conductNotes && (
                      <div><p className="text-xs text-gray-400 mb-1">Condutas</p><p className="text-gray-700">{rec.conductNotes}</p></div>
                    )}
                    {rec.status === 'finalized' && (
                      <button
                        onClick={() => navigate(`/asos/new?patientId=${apt.patient?.id}&companyId=${apt.company?.id || ''}&doctorId=${apt.doctor?.id}`)}
                        className="btn-secondary btn-sm w-full justify-center mt-2"
                      >
                        Gerar ASO a partir deste prontuário
                      </button>
                    )}
                  </div>
                </div>
              )
            } catch { return null }
          })()}

          {/* Informações de cancelamento */}
          {apt.status === 'CANCELLED' && apt.cancellationReason && (
            <div className="card border-red-200 bg-red-50">
              <div className="card-body">
                <p className="text-xs font-semibold text-red-700 mb-1">Motivo do cancelamento</p>
                <p className="text-sm text-red-800">{apt.cancellationReason}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { ArrowLeft, Edit, Calendar, Building2, Phone, User, Loader2, Plus, FileText, Upload, Trash2, Download, FileImage, File } from 'lucide-react'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'

const DOC_TYPES = [
  { value: 'EXAME', label: 'Exame' },
  { value: 'LAUDO', label: 'Laudo' },
  { value: 'ASO', label: 'ASO' },
  { value: 'RECEITA', label: 'Receita' },
  { value: 'ATESTADO', label: 'Atestado' },
  { value: 'OUTRO', label: 'Outro' },
]

const TYPE_COLORS: Record<string, string> = {
  EXAME: 'bg-blue-100 text-blue-700',
  LAUDO: 'bg-purple-100 text-purple-700',
  ASO: 'bg-green-100 text-green-700',
  RECEITA: 'bg-amber-100 text-amber-700',
  ATESTADO: 'bg-orange-100 text-orange-700',
  OUTRO: 'bg-gray-100 text-gray-600',
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['jpg','jpeg','png','gif','webp'].includes(ext || '')) return <FileImage className="w-5 h-5 text-blue-400" />
  if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-400" />
  return <File className="w-5 h-5 text-gray-400" />
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const typeLabel: Record<string, string> = {
  INITIAL:'Inicial', PERIODIC:'Periódico', DISMISSAL:'Demissional', ASO:'ASO', FOLLOWUP:'Acompanhamento', RETURN:'Retorno'
}
const statusColor: Record<string, string> = {
  SCHEDULED:'bg-blue-100 text-blue-700', CONFIRMED:'bg-green-100 text-green-700',
  COMPLETED:'bg-gray-100 text-gray-600', CANCELLED:'bg-red-100 text-red-600', NO_SHOW:'bg-orange-100 text-orange-700'
}
const statusLabel: Record<string, string> = {
  SCHEDULED:'Agendado', CONFIRMED:'Confirmado', COMPLETED:'Concluído', CANCELLED:'Cancelado', NO_SHOW:'Faltou'
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700">{value || <span className="text-gray-300">—</span>}</span>
    </div>
  )
}

export default function PatientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadType, setUploadType] = useState('EXAME')
  const [uploading, setUploading] = useState(false)

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => api.get(`/patients/${id}`).then(r => r.data.data),
  })

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ['patient-documents', id],
    queryFn: () => api.get(`/patients/${id}/documents`).then(r => r.data.data),
    enabled: !!id,
  })

  const deleteDoc = useMutation({
    mutationFn: (docId: string) => api.delete(`/patients/${id}/documents/${docId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-documents', id] })
      toast.success('Documento removido.')
    },
    onError: () => toast.error('Erro ao remover documento.'),
  })

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('type', uploadType)
      await api.post(`/patients/${id}/documents?type=${uploadType}`, form)
      qc.invalidateQueries({ queryKey: ['patient-documents', id] })
      toast.success('Documento enviado com sucesso!')
    } catch {
      toast.error('Erro ao enviar documento.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
  if (!patient) return <div className="text-center py-20 text-gray-400">Paciente não encontrado.</div>

  const addr = patient.address as any
  const addrStr = addr ? [addr.street, addr.number, addr.neighborhood, addr.city, addr.state].filter(Boolean).join(', ') : null

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost btn-sm"><ArrowLeft size={16} /></button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold flex-shrink-0">
              {patient.fullName.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{patient.fullName}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`badge text-xs ${patient.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {patient.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                </span>
                {patient.currentJobTitle && <span className="text-xs text-gray-400">{patient.currentJobTitle}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/appointments/new?patientId=${id}`} className="btn-primary btn-sm">
            <Plus size={14} /> Agendar
          </Link>
          <Link to={`/patients/${id}/edit`} className="btn-secondary btn-sm">
            <Edit size={14} /> Editar
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><h2 className="text-sm font-semibold flex items-center gap-2"><User size={14} className="text-blue-500" /> Dados Pessoais</h2></div>
            <div className="card-body">
              <InfoRow label="Data de nasc." value={patient.birthDate ? dayjs(patient.birthDate).format('DD/MM/YYYY') : null} />
              <InfoRow label="Gênero" value={patient.gender === 'male' ? 'Masculino' : patient.gender === 'female' ? 'Feminino' : patient.gender} />
              <InfoRow label="Grupo sang." value={patient.bloodType} />
              <InfoRow label="Altura" value={patient.heightCm ? `${patient.heightCm} cm` : null} />
              <InfoRow label="Peso" value={patient.weightKg ? `${patient.weightKg} kg` : null} />
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2 className="text-sm font-semibold flex items-center gap-2"><Phone size={14} className="text-blue-500" /> Contato</h2></div>
            <div className="card-body">
              <InfoRow label="Telefone" value={patient.phone} />
              <InfoRow label="WhatsApp" value={patient.whatsapp} />
              <InfoRow label="E-mail" value={patient.email} />
              {addrStr && (
                <div className="flex items-start gap-2 py-2">
                  <span className="text-xs text-gray-400 w-32 flex-shrink-0 pt-0.5">Endereço</span>
                  <span className="text-sm text-gray-700">{addrStr}</span>
                </div>
              )}
            </div>
          </div>

          {patient.company && (
            <div className="card">
              <div className="card-header"><h2 className="text-sm font-semibold flex items-center gap-2"><Building2 size={14} className="text-blue-500" /> Empresa</h2></div>
              <div className="card-body">
                <p className="text-sm font-medium text-gray-800">{patient.company.tradeName || patient.company.legalName}</p>
                <p className="text-xs text-gray-400 mt-1">{patient.currentJobTitle || 'Cargo não informado'}</p>
                {patient.company.riskLevel && <p className="text-xs text-gray-400 mt-1">Grau de risco: {patient.company.riskLevel}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Coluna direita - histórico */}
        <div className="lg:col-span-2 space-y-4">
          {/* Restrições médicas */}
          {patient.medicalRestrictions && (
            <div className="card border-orange-200 bg-orange-50">
              <div className="card-body">
                <p className="text-xs font-semibold text-orange-700 mb-1">⚠ Restrições médicas</p>
                <p className="text-sm text-orange-800">{patient.medicalRestrictions}</p>
              </div>
            </div>
          )}

          {/* Alergias */}
          {Array.isArray(patient.allergies) && patient.allergies.length > 0 && (
            <div className="card border-red-200 bg-red-50">
              <div className="card-body">
                <p className="text-xs font-semibold text-red-700 mb-2">Alergias</p>
                <div className="flex flex-wrap gap-2">
                  {patient.allergies.map((a: any, i: number) => (
                    <span key={i} className="badge bg-red-100 text-red-700">{a.substance}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Histórico de consultas */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Calendar size={14} className="text-blue-500" /> Histórico de Consultas</h2>
              <Link to={`/appointments/new?patientId=${id}`} className="btn-primary btn-sm">
                <Plus size={12} /> Nova
              </Link>
            </div>
            <div>
              {!patient.recentAppointments?.length ? (
                <div className="px-6 py-10 text-center">
                  <Calendar size={28} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">Nenhuma consulta registrada</p>
                </div>
              ) : patient.recentAppointments.map((apt: any) => (
                <Link key={apt.id} to={`/appointments/${apt.id}`} className="flex items-center gap-4 px-6 py-3.5 border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-center w-12 flex-shrink-0">
                    <p className="text-sm font-bold text-gray-800">{dayjs(apt.scheduledAt).format('DD/MM')}</p>
                    <p className="text-xs text-gray-400">{dayjs(apt.scheduledAt).format('YYYY')}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{typeLabel[apt.appointmentType] || apt.appointmentType}</p>
                    <p className="text-xs text-gray-400">Dr. {apt.doctor?.fullName}</p>
                  </div>
                  <span className={`badge text-xs ${statusColor[apt.status] || 'bg-gray-100 text-gray-600'}`}>
                    {statusLabel[apt.status] || apt.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Documentos */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <FileText size={14} className="text-blue-500" /> Documentos
                {documents.length > 0 && (
                  <span className="badge bg-gray-100 text-gray-500 text-xs">{documents.length}</span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <select
                  value={uploadType}
                  onChange={e => setUploadType(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="btn-primary btn-sm"
                >
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {uploading ? 'Enviando...' : 'Enviar'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileChange}
                />
              </div>
            </div>
            <div>
              {documents.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <FileText size={28} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">Nenhum documento anexado</p>
                  <p className="text-xs text-gray-300 mt-1">Selecione o tipo e clique em "Enviar"</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                      <div className="flex-shrink-0">{fileIcon(doc.fileName)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.fileName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[doc.type] || TYPE_COLORS.OUTRO}`}>
                            {DOC_TYPES.find(t => t.value === doc.type)?.label || doc.type}
                          </span>
                          <span className="text-xs text-gray-400">{dayjs(doc.uploadedAt).format('DD/MM/YYYY')}</span>
                          {doc.fileSize && <span className="text-xs text-gray-300">{formatBytes(doc.fileSize)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {doc.downloadUrl && (
                          <a
                            href={doc.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg"
                            title="Baixar"
                          >
                            <Download size={14} />
                          </a>
                        )}
                        <button
                          onClick={() => { if (confirm('Remover este documento?')) deleteDoc.mutate(doc.id) }}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                          title="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

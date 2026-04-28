import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patientService } from '../../lib/patients'
import { ArrowLeft, Edit, Plus, Loader2, Phone, Building2, Calendar, User } from 'lucide-react'
import { APPOINTMENT_TYPE_LABEL, APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_COLOR } from '../../types'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700">{value || <span className="text-gray-300">—</span>}</span>
    </div>
  )
}

export default function PatientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientService.getById(id!),
  })

  const { data: history } = useQuery({
    queryKey: ['patient-history', id],
    queryFn: () => patientService.getAppointments(id!),
    enabled: Boolean(id),
  })

  const deactivate = useMutation({
    mutationFn: () => patientService.delete(id!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patients'] }); toast.success('Paciente inativado.'); navigate('/patients') },
  })

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 size={26} className="animate-spin text-blue-500" /></div>
  if (!patient) return <div className="text-center py-20 text-gray-400">Paciente não encontrado.</div>

  const addr = patient.address as any
  const addrStr = addr ? [addr.street, addr.number, addr.neighborhood, addr.city, addr.state].filter(Boolean).join(', ') : null

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost btn-sm"><ArrowLeft size={16} /></button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-lg font-bold">
              {patient.fullName.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{patient.fullName}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`badge text-xs ${patient.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {patient.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                </span>
                {patient.currentJobTitle && <span className="text-xs text-gray-400">{patient.currentJobTitle}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={'/appointments/new?patientId=' + id} className="btn-primary btn-sm"><Plus size={13} /> Agendar</Link>
          <Link to={'/patients/' + id + '/edit'} className="btn-secondary btn-sm"><Edit size={13} /> Editar</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><h2 className="text-xs font-semibold flex items-center gap-1.5 text-gray-600"><User size={13} /> Dados Pessoais</h2></div>
            <div className="card-body">
              <Row label="CPF" value={patient.cpf} />
              <Row label="Nascimento" value={patient.birthDate ? dayjs(patient.birthDate).format('DD/MM/YYYY') : null} />
              <Row label="Gênero" value={patient.gender === 'male' ? 'Masculino' : patient.gender === 'female' ? 'Feminino' : patient.gender} />
              <Row label="Grupo sang." value={patient.bloodType} />
              <Row label="Altura" value={patient.heightCm ? patient.heightCm + ' cm' : null} />
              <Row label="Peso" value={patient.weightKg ? patient.weightKg + ' kg' : null} />
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2 className="text-xs font-semibold flex items-center gap-1.5 text-gray-600"><Phone size={13} /> Contato</h2></div>
            <div className="card-body">
              <Row label="Telefone" value={patient.phone} />
              <Row label="WhatsApp" value={patient.whatsapp} />
              <Row label="E-mail" value={patient.email} />
              <Row label="Endereço" value={addrStr} />
            </div>
          </div>

          {patient.currentCompanyName && (
            <div className="card">
              <div className="card-header"><h2 className="text-xs font-semibold flex items-center gap-1.5 text-gray-600"><Building2 size={13} /> Empresa</h2></div>
              <div className="card-body">
                <p className="text-sm font-medium text-gray-800">{patient.currentCompanyName}</p>
                <p className="text-xs text-gray-400 mt-1">{patient.currentJobTitle || 'Cargo não informado'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {patient.medicalRestrictions && (
            <div className="card border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-semibold text-orange-700 mb-1">⚠ Restrições médicas</p>
              <p className="text-sm text-orange-800">{patient.medicalRestrictions}</p>
            </div>
          )}
          {Array.isArray(patient.allergies) && patient.allergies.length > 0 && (
            <div className="card border-red-200 bg-red-50 p-4">
              <p className="text-xs font-semibold text-red-700 mb-2">Alergias</p>
              <div className="flex flex-wrap gap-1.5">
                {patient.allergies.map((a: any, i: number) => (
                  <span key={i} className="badge bg-red-100 text-red-700">{a.substance}</span>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-xs font-semibold flex items-center gap-1.5 text-gray-600"><Calendar size={13} /> Histórico de Consultas</h2>
              <Link to={'/appointments/new?patientId=' + id} className="btn-primary btn-sm"><Plus size={12} /> Nova</Link>
            </div>
            {!history?.length ? (
              <div className="px-5 py-10 text-center">
                <Calendar size={26} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Nenhuma consulta registrada</p>
              </div>
            ) : (history as any[]).map((apt: any) => (
              <Link key={apt.id} to={'/appointments/' + apt.id} className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="text-center w-10 flex-shrink-0">
                  <p className="text-xs font-bold text-gray-800">{dayjs(apt.scheduledAt?.toDate?.() || apt.scheduledAt).format('DD/MM')}</p>
                  <p className="text-xs text-gray-400">{dayjs(apt.scheduledAt?.toDate?.() || apt.scheduledAt).format('YYYY')}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">{APPOINTMENT_TYPE_LABEL[apt.appointmentType as keyof typeof APPOINTMENT_TYPE_LABEL] || apt.appointmentType}</p>
                  <p className="text-xs text-gray-400">{apt.doctorName}</p>
                </div>
                <span className={`badge text-xs ${APPOINTMENT_STATUS_COLOR[apt.status as keyof typeof APPOINTMENT_STATUS_COLOR] || 'bg-gray-100 text-gray-600'}`}>
                  {APPOINTMENT_STATUS_LABEL[apt.status as keyof typeof APPOINTMENT_STATUS_LABEL] || apt.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

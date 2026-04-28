import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { ArrowLeft, Plus, Trash2, Save, CheckCircle, FileText, Stethoscope, Pill, FlaskConical, ClipboardList, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Diagnosis { cid10: string; description: string; type: 'primary' | 'secondary' }
interface Prescription { drug: string; dosage: string; route: string; frequency: string; days: string }
interface ExamRequest { description: string; urgency: 'routine' | 'urgent' | 'emergency' }

interface MedicalRecord {
  _type: 'medical_record'
  version: number
  status: 'draft' | 'finalized'
  finalizedAt?: string
  chiefComplaint: string
  anamnesis: string
  occupationalHistory: string
  physicalExam: {
    general: string; cardiovascular: string; respiratory: string
    abdomen: string; musculoskeletal: string; neurological: string; others: string
  }
  vitalSigns: { bp: string; hr: string; rr: string; temp: string; spo2: string; weight: string; height: string }
  diagnoses: Diagnosis[]
  prescriptions: Prescription[]
  examRequests: ExamRequest[]
  conductNotes: string
  workLeave: { active: boolean; days: string; startDate: string; reason: string; restrictions: string; type: string }
}

// ─── CID-10 comuns em medicina do trabalho ────────────────────────────────────

const COMMON_CIDS = [
  { code: 'Z00.0', desc: 'Exame médico geral' },
  { code: 'Z00.1', desc: 'Exame de saúde de rotina da criança' },
  { code: 'Z04.2', desc: 'Exame por razão administrativa' },
  { code: 'Z10.0', desc: 'Exame de saúde ocupacional' },
  { code: 'Z57.0', desc: 'Exposição ocupacional a ruído' },
  { code: 'Z57.2', desc: 'Exposição ocupacional a poeira' },
  { code: 'Z57.5', desc: 'Exposição ocupacional a substâncias tóxicas' },
  { code: 'Z57.7', desc: 'Exposição ocupacional a agentes físicos' },
  { code: 'H83.3', desc: 'Perda auditiva induzida por ruído (PAIR)' },
  { code: 'J68.0', desc: 'Broncopneumopatia por vapores, fumaças e gases' },
  { code: 'L23', desc: 'Dermatite de contato alérgica' },
  { code: 'M54.5', desc: 'Lombalgia' },
  { code: 'M54.4', desc: 'Lumbago com ciática' },
  { code: 'F41.1', desc: 'Transtorno de ansiedade generalizada' },
  { code: 'F32', desc: 'Episódio depressivo' },
  { code: 'G43', desc: 'Enxaqueca' },
  { code: 'J30', desc: 'Rinite alérgica' },
  { code: 'I10', desc: 'Hipertensão essencial' },
  { code: 'E11', desc: 'Diabetes mellitus tipo 2' },
  { code: 'K21.0', desc: 'Doença de refluxo gastroesofágico' },
]

// ─── Estado inicial ───────────────────────────────────────────────────────────

function emptyRecord(): MedicalRecord {
  return {
    _type: 'medical_record', version: 1, status: 'draft',
    chiefComplaint: '', anamnesis: '', occupationalHistory: '',
    physicalExam: { general: '', cardiovascular: '', respiratory: '', abdomen: '', musculoskeletal: '', neurological: '', others: '' },
    vitalSigns: { bp: '', hr: '', rr: '', temp: '', spo2: '', weight: '', height: '' },
    diagnoses: [],
    prescriptions: [],
    examRequests: [],
    conductNotes: '',
    workLeave: { active: false, days: '', startDate: '', reason: '', restrictions: '', type: 'empresa' },
  }
}

function parseRecord(notes: string | null | undefined): MedicalRecord {
  if (!notes) return emptyRecord()
  try {
    const parsed = JSON.parse(notes)
    if (parsed._type === 'medical_record') return { ...emptyRecord(), ...parsed }
  } catch { /* ignore */ }
  return emptyRecord()
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MedicalRecordPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [rec, setRec] = useState<MedicalRecord>(emptyRecord())
  const [cidSearch, setCidSearch] = useState('')
  const [cidOpen, setCidOpen] = useState(false)

  const { data: apt } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => api.get(`/appointments/${id}`).then(r => r.data.data),
    enabled: !!id,
  })

  // Pré-preenche a partir do agendamento e triagem
  useEffect(() => {
    if (!apt) return
    const existing = parseRecord(apt.notes)
    // Pré-preenche sinais vitais da triagem se não há prontuário ainda
    if (!apt.notes && apt.triage?.responses?.length) {
      const tv = (key: string) => apt.triage.responses.find((r: any) => r.key === key)?.value || ''
      existing.vitalSigns = { bp: tv('pa'), hr: tv('fc'), rr: tv('fr'), temp: tv('temp'), spo2: tv('spo2'), weight: tv('peso'), height: tv('altura') }
      existing.chiefComplaint = tv('queixa')
    }
    setRec(existing)
  }, [apt?.id])

  const imc = (() => {
    const w = Number(rec.vitalSigns.weight); const h = Number(rec.vitalSigns.height)
    if (w && h) return (w / Math.pow(h / 100, 2)).toFixed(1)
    return null
  })()

  const saveMut = useMutation({
    mutationFn: (status: 'draft' | 'finalized') => {
      const payload = { ...rec, status, version: (rec.version || 1) + (status === 'finalized' ? 1 : 0), finalizedAt: status === 'finalized' ? new Date().toISOString() : rec.finalizedAt }
      return api.put(`/appointments/${id}`, { notes: JSON.stringify(payload) })
    },
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ['appointment', id] })
      toast.success(status === 'finalized' ? 'Prontuário finalizado!' : 'Rascunho salvo!')
      if (status === 'finalized') navigate(`/appointments/${id}`)
    },
    onError: () => toast.error('Erro ao salvar prontuário'),
  })

  function setField<K extends keyof MedicalRecord>(key: K, val: MedicalRecord[K]) {
    setRec(r => ({ ...r, [key]: val }))
  }
  function setVital(key: string, val: string) {
    setRec(r => ({ ...r, vitalSigns: { ...r.vitalSigns, [key]: val } }))
  }
  function setExam(key: string, val: string) {
    setRec(r => ({ ...r, physicalExam: { ...r.physicalExam, [key]: val } }))
  }
  function setWorkLeave(key: string, val: string | boolean) {
    setRec(r => ({ ...r, workLeave: { ...r.workLeave, [key]: val } }))
  }

  function addDiagnosis(cid10: string, description: string) {
    if (rec.diagnoses.find(d => d.cid10 === cid10)) return
    setRec(r => ({ ...r, diagnoses: [...r.diagnoses, { cid10, description, type: r.diagnoses.length === 0 ? 'primary' : 'secondary' }] }))
    setCidSearch(''); setCidOpen(false)
  }

  const filteredCids = COMMON_CIDS.filter(c =>
    c.code.toLowerCase().includes(cidSearch.toLowerCase()) ||
    c.desc.toLowerCase().includes(cidSearch.toLowerCase())
  )

  if (!apt) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>

  const isFinalized = rec.status === 'finalized'

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/appointments/${id}`)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-500" /> Prontuário Médico
            </h1>
            <p className="text-sm text-gray-500">
              {apt.patient?.fullName} · {dayjs(apt.scheduledAt).format('DD/MM/YYYY HH:mm')} · Dr. {apt.doctor?.fullName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFinalized && (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> Finalizado
            </span>
          )}
          {!isFinalized && (
            <>
              <button onClick={() => saveMut.mutate('draft')} disabled={saveMut.isPending}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Save className="w-4 h-4" /> Salvar rascunho
              </button>
              <button onClick={() => {
                if (!rec.diagnoses.length) { toast.error('Adicione pelo menos um diagnóstico'); return }
                saveMut.mutate('finalized')
              }} disabled={saveMut.isPending}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium">
                <CheckCircle className="w-4 h-4" />
                {saveMut.isPending ? 'Salvando...' : 'Finalizar prontuário'}
              </button>
            </>
          )}
          {isFinalized && (
            <button
              onClick={() => navigate(`/asos/new?appointmentId=${id}&patientId=${apt.patient?.id}&companyId=${apt.company?.id || ''}&doctorId=${apt.doctor?.id}`)}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium"
            >
              <ClipboardList className="w-4 h-4" /> Gerar ASO
            </button>
          )}
        </div>
      </div>

      {isFinalized && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          Prontuário finalizado em {dayjs(rec.finalizedAt).format('DD/MM/YYYY [às] HH:mm')}. Para editar, salve um novo rascunho.
        </div>
      )}

      {/* 1. Anamnese */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-indigo-500" /> Anamnese
        </h2>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Queixa Principal</label>
          <input disabled={isFinalized}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50"
            placeholder="Ex: Dor lombar há 3 dias com irradiação para MMII"
            value={rec.chiefComplaint} onChange={e => setField('chiefComplaint', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">HDA — História da Doença Atual</label>
          <textarea disabled={isFinalized} rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none disabled:bg-gray-50"
            placeholder="Descreva o início, evolução, fatores de melhora/piora, sintomas associados..."
            value={rec.anamnesis} onChange={e => setField('anamnesis', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">História Ocupacional</label>
          <textarea disabled={isFinalized} rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none disabled:bg-gray-50"
            placeholder="Função atual, tempo no cargo, exposições ocupacionais, EPIs utilizados..."
            value={rec.occupationalHistory} onChange={e => setField('occupationalHistory', e.target.value)} />
        </div>
      </section>

      {/* 2. Sinais Vitais */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Sinais Vitais</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { key: 'bp', label: 'Pressão Arterial', unit: 'mmHg', placeholder: '120/80' },
            { key: 'hr', label: 'Freq. Cardíaca', unit: 'bpm', placeholder: '72' },
            { key: 'rr', label: 'Freq. Respiratória', unit: 'irpm', placeholder: '16' },
            { key: 'temp', label: 'Temperatura', unit: '°C', placeholder: '36.5' },
            { key: 'spo2', label: 'SpO₂', unit: '%', placeholder: '98' },
            { key: 'weight', label: 'Peso', unit: 'kg', placeholder: '70' },
            { key: 'height', label: 'Altura', unit: 'cm', placeholder: '175' },
          ].map(v => (
            <div key={v.key}>
              <label className="block text-xs text-gray-500 mb-1">{v.label} <span className="text-gray-400">({v.unit})</span></label>
              <input disabled={isFinalized} placeholder={v.placeholder}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50"
                value={(rec.vitalSigns as any)[v.key]} onChange={e => setVital(v.key, e.target.value)} />
            </div>
          ))}
          {imc && (
            <div className="flex items-end">
              <div className={`w-full px-3 py-2 rounded-lg text-sm font-semibold text-center ${Number(imc) >= 30 ? 'bg-red-100 text-red-700' : Number(imc) >= 25 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                IMC: {imc}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Exame Físico */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-800">Exame Físico</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: 'general', label: 'Estado Geral' },
            { key: 'cardiovascular', label: 'Aparelho Cardiovascular' },
            { key: 'respiratory', label: 'Aparelho Respiratório' },
            { key: 'abdomen', label: 'Abdômen' },
            { key: 'musculoskeletal', label: 'Aparelho Locomotor' },
            { key: 'neurological', label: 'Neurológico' },
            { key: 'others', label: 'Outros' },
          ].map(f => (
            <div key={f.key} className={f.key === 'others' ? 'sm:col-span-2' : ''}>
              <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
              <input disabled={isFinalized}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50"
                placeholder="Sem alterações"
                value={(rec.physicalExam as any)[f.key]} onChange={e => setExam(f.key, e.target.value)} />
            </div>
          ))}
        </div>
      </section>

      {/* 4. Diagnóstico CID-10 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-indigo-500" /> Diagnóstico (CID-10)
        </h2>
        {!isFinalized && (
          <div className="relative">
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Buscar CID-10 (ex: Z00.0 ou lombalgia)..."
              value={cidSearch}
              onChange={e => { setCidSearch(e.target.value); setCidOpen(true) }}
              onFocus={() => setCidOpen(true)}
              onBlur={() => setTimeout(() => setCidOpen(false), 200)}
            />
            {cidOpen && cidSearch && (
              <div className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                {filteredCids.length === 0 ? (
                  <div className="px-4 py-3">
                    <button className="text-sm text-indigo-600 hover:underline"
                      onClick={() => addDiagnosis(cidSearch.split(' ')[0], cidSearch.substring(cidSearch.indexOf(' ') + 1) || cidSearch)}>
                      + Adicionar "{cidSearch}" como diagnóstico personalizado
                    </button>
                  </div>
                ) : filteredCids.map(c => (
                  <button key={c.code} onClick={() => addDiagnosis(c.code, c.desc)}
                    className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm flex items-center gap-2">
                    <span className="font-mono text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{c.code}</span>
                    {c.desc}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {rec.diagnoses.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">Nenhum diagnóstico adicionado</p>
        ) : (
          <div className="space-y-2">
            {rec.diagnoses.map((d, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg bg-gray-50">
                <span className="font-mono text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">{d.cid10}</span>
                <span className="flex-1 text-sm text-gray-800">{d.description}</span>
                <select disabled={isFinalized} value={d.type}
                  onChange={e => setRec(r => ({ ...r, diagnoses: r.diagnoses.map((x, j) => j === i ? { ...x, type: e.target.value as any } : x) }))}
                  className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none bg-white disabled:bg-gray-50">
                  <option value="primary">Principal</option>
                  <option value="secondary">Secundário</option>
                </select>
                {!isFinalized && (
                  <button onClick={() => setRec(r => ({ ...r, diagnoses: r.diagnoses.filter((_, j) => j !== i) }))}
                    className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Prescrição */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Pill className="w-4 h-4 text-indigo-500" /> Prescrição
          </h2>
          {!isFinalized && (
            <button onClick={() => setRec(r => ({ ...r, prescriptions: [...r.prescriptions, { drug: '', dosage: '', route: 'oral', frequency: '', days: '' }] }))}
              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          )}
        </div>
        {rec.prescriptions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">Nenhuma medicação prescrita</p>
        ) : (
          <div className="space-y-2">
            {rec.prescriptions.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center p-3 border border-gray-100 rounded-lg bg-gray-50">
                <input disabled={isFinalized} placeholder="Medicamento" value={p.drug}
                  onChange={e => setRec(r => ({ ...r, prescriptions: r.prescriptions.map((x, j) => j === i ? { ...x, drug: e.target.value } : x) }))}
                  className="col-span-3 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-white" />
                <input disabled={isFinalized} placeholder="Dose (ex: 500mg)" value={p.dosage}
                  onChange={e => setRec(r => ({ ...r, prescriptions: r.prescriptions.map((x, j) => j === i ? { ...x, dosage: e.target.value } : x) }))}
                  className="col-span-2 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-white" />
                <select disabled={isFinalized} value={p.route}
                  onChange={e => setRec(r => ({ ...r, prescriptions: r.prescriptions.map((x, j) => j === i ? { ...x, route: e.target.value } : x) }))}
                  className="col-span-2 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none disabled:bg-white">
                  {['oral','tópico','inalatório','injetável','sublingual','nasal','oftálmico'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <input disabled={isFinalized} placeholder="Frequência (ex: 8/8h)" value={p.frequency}
                  onChange={e => setRec(r => ({ ...r, prescriptions: r.prescriptions.map((x, j) => j === i ? { ...x, frequency: e.target.value } : x) }))}
                  className="col-span-2 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-white" />
                <input disabled={isFinalized} placeholder="Dias" value={p.days}
                  onChange={e => setRec(r => ({ ...r, prescriptions: r.prescriptions.map((x, j) => j === i ? { ...x, days: e.target.value } : x) }))}
                  className="col-span-2 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-white" />
                {!isFinalized && (
                  <button onClick={() => setRec(r => ({ ...r, prescriptions: r.prescriptions.filter((_, j) => j !== i) }))}
                    className="col-span-1 text-red-400 hover:text-red-600 flex justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 6. Solicitação de Exames */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-indigo-500" /> Solicitação de Exames
          </h2>
          {!isFinalized && (
            <button onClick={() => setRec(r => ({ ...r, examRequests: [...r.examRequests, { description: '', urgency: 'routine' }] }))}
              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          )}
        </div>
        {rec.examRequests.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">Nenhum exame solicitado</p>
        ) : (
          <div className="space-y-2">
            {rec.examRequests.map((e, i) => (
              <div key={i} className="flex gap-2 items-center p-3 border border-gray-100 rounded-lg bg-gray-50">
                <input disabled={isFinalized} placeholder="Ex: Hemograma completo, Audiometria tonal, Rx coluna lombar..." value={e.description}
                  onChange={ev => setRec(r => ({ ...r, examRequests: r.examRequests.map((x, j) => j === i ? { ...x, description: ev.target.value } : x) }))}
                  className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-white" />
                <select disabled={isFinalized} value={e.urgency}
                  onChange={ev => setRec(r => ({ ...r, examRequests: r.examRequests.map((x, j) => j === i ? { ...x, urgency: ev.target.value as any } : x) }))}
                  className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none disabled:bg-white">
                  <option value="routine">Rotina</option>
                  <option value="urgent">Urgente</option>
                  <option value="emergency">Emergência</option>
                </select>
                {!isFinalized && (
                  <button onClick={() => setRec(r => ({ ...r, examRequests: r.examRequests.filter((_, j) => j !== i) }))}
                    className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 7. Condutas */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-3">Condutas e Orientações</h2>
        <textarea disabled={isFinalized} rows={4}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none disabled:bg-gray-50"
          placeholder="Orientações ao paciente, encaminhamentos, retorno, plano terapêutico..."
          value={rec.conductNotes} onChange={e => setField('conductNotes', e.target.value)} />
      </section>

      {/* 8. Afastamento */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-gray-800">Afastamento do Trabalho</h2>
          <label className="flex items-center gap-2 ml-auto cursor-pointer">
            <input type="checkbox" disabled={isFinalized} checked={rec.workLeave.active}
              onChange={e => setWorkLeave('active', e.target.checked)} className="w-4 h-4 accent-amber-500" />
            <span className="text-sm text-gray-600">Indicar afastamento</span>
          </label>
        </div>
        {rec.workLeave.active && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Dias de afastamento</label>
              <input disabled={isFinalized} type="number" min="1" value={rec.workLeave.days}
                onChange={e => setWorkLeave('days', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data de início</label>
              <input disabled={isFinalized} type="date" value={rec.workLeave.startDate}
                onChange={e => setWorkLeave('startDate', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo</label>
              <select disabled={isFinalized} value={rec.workLeave.type}
                onChange={e => setWorkLeave('type', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none disabled:bg-gray-50">
                <option value="empresa">Atestado empresa</option>
                <option value="inss">Afastamento INSS</option>
                <option value="acidente">Acidente de trabalho (CAT)</option>
              </select>
            </div>
            <div className="sm:col-span-4">
              <label className="block text-xs text-gray-500 mb-1">Motivo / Restrições</label>
              <input disabled={isFinalized} value={rec.workLeave.reason}
                onChange={e => setWorkLeave('reason', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:bg-gray-50"
                placeholder="Descreva o motivo e restrições impostas..." />
            </div>
          </div>
        )}
      </section>

      {/* Rodapé com botões */}
      {!isFinalized && (
        <div className="flex justify-end gap-3 sticky bottom-0 bg-gray-50 py-4 -mx-6 px-6 border-t border-gray-200">
          <button onClick={() => navigate(`/appointments/${id}`)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
          <button onClick={() => saveMut.mutate('draft')} disabled={saveMut.isPending}
            className="px-4 py-2 text-sm border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 flex items-center gap-2">
            <Save className="w-4 h-4" /> Salvar rascunho
          </button>
          <button onClick={() => {
            if (!rec.diagnoses.length) { toast.error('Adicione pelo menos um diagnóstico (CID-10)'); return }
            saveMut.mutate('finalized')
          }} disabled={saveMut.isPending}
            className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium disabled:opacity-50">
            <CheckCircle className="w-4 h-4" />
            {saveMut.isPending ? 'Finalizando...' : 'Finalizar prontuário'}
          </button>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'

const EXAM_TYPES = [
  { value: 'ADMISSIONAL', label: 'Admissional' },
  { value: 'PERIODICO', label: 'Periódico' },
  { value: 'RETORNO_TRABALHO', label: 'Retorno ao Trabalho' },
  { value: 'MUDANCA_FUNCAO', label: 'Mudança de Função' },
  { value: 'DEMISSIONAL', label: 'Demissional' },
]

const CONCLUSIONS = [
  { value: 'APTO', label: 'Apto' },
  { value: 'APTO_RESTRICOES', label: 'Apto com Restrições' },
  { value: 'INAPTO', label: 'Inapto' },
]

interface ComplementaryExam {
  name: string; result: string; date: string
}
interface RiskFactor {
  code: string; description: string; level: string
}

export default function AsoFormPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const qc = useQueryClient()

  const prePatientId = params.get('patientId') || ''
  const preAppointmentId = params.get('appointmentId') || ''

  const [patientSearch, setPatientSearch] = useState('')
  const [patientId, setPatientId] = useState(prePatientId)
  const [appointmentId] = useState(preAppointmentId)
  const [examType, setExamType] = useState('ADMISSIONAL')
  const [conclusion, setConclusion] = useState('APTO')
  const [restrictions, setRestrictions] = useState('')
  const [observations, setObservations] = useState('')
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().split('T')[0])
  const [validUntil, setValidUntil] = useState('')
  const [compExams, setCompExams] = useState<ComplementaryExam[]>([])
  const [risks, setRisks] = useState<RiskFactor[]>([])
  const [error, setError] = useState('')

  const { data: patientsData } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: () => api.get(`/patients?search=${encodeURIComponent(patientSearch)}&limit=10`).then(r => r.data.data),
    enabled: patientSearch.length >= 2,
  })

  const { data: selectedPatient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api.get(`/patients/${patientId}`).then(r => r.data.data),
    enabled: !!patientId,
  })

  useEffect(() => {
    if (selectedPatient) setPatientSearch(selectedPatient.fullName)
  }, [selectedPatient])

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/asos', body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['asos'] })
      navigate(`/asos/${res.data.data.id}`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setError(msg || 'Erro ao emitir ASO')
    },
  })

  function addCompExam() {
    setCompExams(prev => [...prev, { name: '', result: '', date: '' }])
  }
  function updateCompExam(i: number, field: keyof ComplementaryExam, value: string) {
    setCompExams(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }
  function removeCompExam(i: number) {
    setCompExams(prev => prev.filter((_, idx) => idx !== i))
  }

  function addRisk() {
    setRisks(prev => [...prev, { code: '', description: '', level: '' }])
  }
  function updateRisk(i: number, field: keyof RiskFactor, value: string) {
    setRisks(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }
  function removeRisk(i: number) {
    setRisks(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!patientId) { setError('Selecione um paciente'); return }
    mutation.mutate({
      patientId,
      appointmentId: appointmentId || undefined,
      examType,
      conclusion,
      restrictions: restrictions || undefined,
      observations: observations || undefined,
      issuedAt,
      validUntil: validUntil || undefined,
      complementaryExams: compExams.filter(e => e.name),
      riskFactors: risks.filter(r => r.description),
    })
  }

  const patients: { id: string; fullName: string; currentJobTitle: string | null }[] = patientsData ?? []

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => navigate('/asos')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Emitir ASO</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Paciente */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Paciente</h2>
          <div className="relative">
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Buscar paciente pelo nome..."
              value={patientSearch}
              onChange={e => { setPatientSearch(e.target.value); setPatientId('') }}
              required={!patientId}
            />
            {patients.length > 0 && !patientId && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {patients.map(p => (
                  <li
                    key={p.id}
                    className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer"
                    onClick={() => { setPatientId(p.id); setPatientSearch(p.fullName) }}
                  >
                    {p.fullName}
                    {p.currentJobTitle && <span className="text-gray-400 ml-1">· {p.currentJobTitle}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selectedPatient && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              Empresa: {selectedPatient.company?.tradeName || selectedPatient.company?.legalName || 'Sem empresa'}
              {selectedPatient.currentJobTitle && ` · Cargo: ${selectedPatient.currentJobTitle}`}
            </div>
          )}
        </div>

        {/* Tipo e conclusão */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Exame</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Tipo de exame *</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={examType}
                onChange={e => setExamType(e.target.value)}
              >
                {EXAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Conclusão *</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={conclusion}
                onChange={e => setConclusion(e.target.value)}
              >
                {CONCLUSIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Data de emissão *</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={issuedAt}
                onChange={e => setIssuedAt(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Válido até</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={validUntil}
                onChange={e => setValidUntil(e.target.value)}
              />
            </div>
          </div>
          {conclusion !== 'APTO' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Restrições / Observações clínicas</label>
              <textarea
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                value={restrictions}
                onChange={e => setRestrictions(e.target.value)}
                placeholder="Descreva as restrições..."
              />
            </div>
          )}
        </div>

        {/* Exames complementares */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Exames Complementares</h2>
            <button type="button" onClick={addCompExam} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
          {compExams.length === 0 && <p className="text-xs text-gray-400">Nenhum exame adicionado</p>}
          {compExams.map((e, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                className="col-span-5 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Nome do exame"
                value={e.name}
                onChange={ev => updateCompExam(i, 'name', ev.target.value)}
              />
              <input
                className="col-span-4 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Resultado"
                value={e.result}
                onChange={ev => updateCompExam(i, 'result', ev.target.value)}
              />
              <input
                type="date"
                className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={e.date}
                onChange={ev => updateCompExam(i, 'date', ev.target.value)}
              />
              <button type="button" onClick={() => removeCompExam(i)} className="col-span-1 text-red-400 hover:text-red-600 flex justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Fatores de risco */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Fatores de Risco</h2>
            <button type="button" onClick={addRisk} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
          {risks.length === 0 && <p className="text-xs text-gray-400">Nenhum fator de risco adicionado</p>}
          {risks.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Código"
                value={r.code}
                onChange={ev => updateRisk(i, 'code', ev.target.value)}
              />
              <input
                className="col-span-7 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Descrição do risco"
                value={r.description}
                onChange={ev => updateRisk(i, 'description', ev.target.value)}
              />
              <input
                className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Nível"
                value={r.level}
                onChange={ev => updateRisk(i, 'level', ev.target.value)}
              />
              <button type="button" onClick={() => removeRisk(i)} className="col-span-1 text-red-400 hover:text-red-600 flex justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Observações gerais */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
          <h2 className="font-semibold text-gray-700">Observações Gerais</h2>
          <textarea
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            value={observations}
            onChange={e => setObservations(e.target.value)}
            placeholder="Observações opcionais..."
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/asos')}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
          >
            {mutation.isPending ? 'Emitindo...' : 'Emitir ASO'}
          </button>
        </div>
      </form>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { ArrowLeft, Printer, Trash2, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const EXAM_LABELS: Record<string, string> = {
  ADMISSIONAL: 'Admissional', PERIODICO: 'Periódico',
  RETORNO_TRABALHO: 'Retorno ao Trabalho', MUDANCA_FUNCAO: 'Mudança de Função', DEMISSIONAL: 'Demissional',
}
const CONCLUSION_STYLES: Record<string, string> = {
  APTO: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  INAPTO: 'bg-red-100 text-red-700 border-red-300',
  APTO_RESTRICOES: 'bg-amber-100 text-amber-700 border-amber-300',
}
const CONCLUSION_LABELS: Record<string, string> = {
  APTO: 'APTO', INAPTO: 'INAPTO', APTO_RESTRICOES: 'APTO COM RESTRIÇÕES',
}

interface AsoDetail {
  id: string
  examType: string
  conclusion: string
  restrictions: string | null
  observations: string | null
  issuedAt: string
  validUntil: string | null
  complementaryExams: { name: string; result?: string; date?: string }[]
  riskFactors: { code: string; description: string; level?: string }[]
  patient: {
    id: string; fullName: string; birthDate: string | null; gender: string | null
    currentJobTitle: string | null; bloodType: string | null; rg: string | null
  }
  company: { id: string; tradeName: string | null; legalName: string; cnpj: string; cnae: string | null; riskLevel: number } | null
  doctor: { id: string; fullName: string; crmNumber: string | null; crmState: string | null }
  tenant: { id: string; name: string; address: unknown; phone: string | null }
}

export default function AsoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [aso, setAso] = useState<AsoDetail | null>(null)
  const [showDelete, setShowDelete] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['aso', id],
    queryFn: () => api.get(`/asos/${id}`).then(r => r.data.data),
    enabled: !!id,
  })

  useEffect(() => { if (data) setAso(data) }, [data])

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/asos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['asos'] }); navigate('/asos') },
  })

  if (isLoading || !aso) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
  }

  const addr = aso.tenant.address as Record<string, string> | null

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" /> Excluir
          </button>
        </div>
      </div>

      {/* Modal confirmação exclusão */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center print:hidden">
          <div className="bg-white rounded-xl p-6 w-80 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h3 className="font-semibold text-gray-800">Excluir ASO?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDelete(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documento ASO */}
      <div className="bg-white border border-gray-200 rounded-xl p-8 print:border-none print:p-0 print:rounded-none">
        {/* Cabeçalho */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 uppercase">{aso.tenant.name}</h1>
              {addr && <p className="text-xs text-gray-500 mt-0.5">{addr.street}{addr.number ? `, ${addr.number}` : ''}{addr.city ? ` — ${addr.city}/${addr.state}` : ''}</p>}
              {aso.tenant.phone && <p className="text-xs text-gray-500">Fone: {aso.tenant.phone}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Atestado de Saúde Ocupacional</p>
              <p className="text-xs text-gray-500 mt-0.5">N° {aso.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-xs text-gray-500">{format(new Date(aso.issuedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
            </div>
          </div>
        </div>

        {/* Tipo de exame */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Tipo de exame</p>
            <p className="font-semibold text-gray-800">{EXAM_LABELS[aso.examType] || aso.examType}</p>
          </div>
          {aso.validUntil && (
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Validade</p>
              <p className="font-semibold text-gray-800">{format(new Date(aso.validUntil), 'dd/MM/yyyy')}</p>
            </div>
          )}
        </div>

        {/* Trabalhador */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Dados do Trabalhador</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div><span className="text-gray-500">Nome: </span><span className="font-medium text-gray-800">{aso.patient.fullName}</span></div>
            {aso.patient.rg && <div><span className="text-gray-500">RG: </span><span className="text-gray-800">{aso.patient.rg}</span></div>}
            {aso.patient.birthDate && <div><span className="text-gray-500">Nascimento: </span><span className="text-gray-800">{format(new Date(aso.patient.birthDate), 'dd/MM/yyyy')}</span></div>}
            {aso.patient.gender && <div><span className="text-gray-500">Sexo: </span><span className="text-gray-800">{aso.patient.gender === 'M' ? 'Masculino' : aso.patient.gender === 'F' ? 'Feminino' : aso.patient.gender}</span></div>}
            {aso.patient.currentJobTitle && <div className="col-span-2"><span className="text-gray-500">Função: </span><span className="text-gray-800">{aso.patient.currentJobTitle}</span></div>}
          </div>
        </div>

        {/* Empresa */}
        {aso.company && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Empresa</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div className="col-span-2"><span className="text-gray-500">Razão Social: </span><span className="font-medium text-gray-800">{aso.company.legalName}</span></div>
              {aso.company.tradeName && <div><span className="text-gray-500">Nome Fantasia: </span><span className="text-gray-800">{aso.company.tradeName}</span></div>}
              <div><span className="text-gray-500">CNPJ: </span><span className="text-gray-800">{aso.company.cnpj}</span></div>
              {aso.company.cnae && <div><span className="text-gray-500">CNAE: </span><span className="text-gray-800">{aso.company.cnae}</span></div>}
              <div><span className="text-gray-500">Grau de risco: </span><span className="text-gray-800">{aso.company.riskLevel}</span></div>
            </div>
          </div>
        )}

        {/* Exames complementares */}
        {aso.complementaryExams.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Exames Complementares</p>
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Exame</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Resultado</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {aso.complementaryExams.map((e, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-gray-800">{e.name}</td>
                    <td className="px-3 py-2 text-gray-600">{e.result || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{e.date ? format(new Date(e.date), 'dd/MM/yyyy') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Fatores de risco */}
        {aso.riskFactors.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Fatores de Risco Ocupacional</p>
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Código</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Descrição</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Nível</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {aso.riskFactors.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-gray-600">{r.code || '—'}</td>
                    <td className="px-3 py-2 text-gray-800">{r.description}</td>
                    <td className="px-3 py-2 text-gray-600">{r.level || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Restrições */}
        {aso.restrictions && (
          <div className="mb-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-700 uppercase tracking-wide font-medium mb-1">Restrições</p>
            <p className="text-sm text-gray-800">{aso.restrictions}</p>
          </div>
        )}

        {/* Observações */}
        {aso.observations && (
          <div className="mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-medium">Observações</p>
            <p className="text-sm text-gray-700">{aso.observations}</p>
          </div>
        )}

        {/* Conclusão */}
        <div className={`text-center py-4 px-6 rounded-xl border-2 mb-6 ${CONCLUSION_STYLES[aso.conclusion]}`}>
          <p className="text-xs uppercase tracking-widest mb-1 opacity-70">Conclusão</p>
          <p className="text-2xl font-bold">{CONCLUSION_LABELS[aso.conclusion] || aso.conclusion}</p>
        </div>

        {/* Assinatura */}
        <div className="mt-10 pt-6 border-t border-gray-200 text-center">
          <div className="inline-block">
            <div className="border-t border-gray-500 w-56 mx-auto mb-1" />
            <p className="text-sm font-medium text-gray-800">Dr(a). {aso.doctor.fullName}</p>
            {aso.doctor.crmNumber && (
              <p className="text-xs text-gray-500">CRM {aso.doctor.crmNumber}/{aso.doctor.crmState}</p>
            )}
          </div>
        </div>
      </div>

      {/* Link paciente */}
      <div className="mt-4 print:hidden">
        <Link to={`/patients/${aso.patient.id}`} className="text-sm text-indigo-600 hover:underline">
          Ver prontuário do paciente →
        </Link>
      </div>
    </div>
  )
}

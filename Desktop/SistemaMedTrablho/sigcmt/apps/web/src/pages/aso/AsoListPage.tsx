import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Plus, Search, FileText, Eye } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const EXAM_LABELS: Record<string, string> = {
  ADMISSIONAL: 'Admissional',
  PERIODICO: 'Periódico',
  RETORNO_TRABALHO: 'Retorno ao Trabalho',
  MUDANCA_FUNCAO: 'Mudança de Função',
  DEMISSIONAL: 'Demissional',
}

const CONCLUSION_STYLES: Record<string, string> = {
  APTO: 'bg-emerald-100 text-emerald-700',
  INAPTO: 'bg-red-100 text-red-700',
  APTO_RESTRICOES: 'bg-amber-100 text-amber-700',
}

const CONCLUSION_LABELS: Record<string, string> = {
  APTO: 'Apto',
  INAPTO: 'Inapto',
  APTO_RESTRICOES: 'Apto c/ Restrições',
}

interface Aso {
  id: string
  examType: string
  conclusion: string
  issuedAt: string
  validUntil: string | null
  patient: { id: string; fullName: string; currentJobTitle: string | null }
  company: { id: string; tradeName: string | null; legalName: string } | null
  doctor: { id: string; fullName: string; crmNumber: string | null; crmState: string | null }
}

export default function AsoListPage() {
  const [search, setSearch] = useState('')
  const [examType, setExamType] = useState('')
  const [page, setPage] = useState(1)

  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (examType) params.set('examType', examType)

  const { data, isLoading } = useQuery({
    queryKey: ['asos', page, examType],
    queryFn: () => api.get(`/asos?${params}`).then(r => r.data),
  })

  const asos: Aso[] = data?.data ?? []
  const total: number = data?.total ?? 0
  const totalPages = Math.ceil(total / 20)

  const filtered = search
    ? asos.filter(a =>
        a.patient.fullName.toLowerCase().includes(search.toLowerCase()) ||
        (a.company?.tradeName || a.company?.legalName || '').toLowerCase().includes(search.toLowerCase())
      )
    : asos

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ASOs</h1>
          <p className="text-sm text-gray-500 mt-1">Atestados de Saúde Ocupacional</p>
        </div>
        <Link
          to="/asos/new"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Novo ASO
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Buscar por paciente ou empresa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={examType}
            onChange={e => { setExamType(e.target.value); setPage(1) }}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(EXAM_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum ASO encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Paciente</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Empresa</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Conclusão</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Emissão</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Validade</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Médico</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(aso => (
                  <tr key={aso.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/patients/${aso.patient.id}`} className="font-medium text-indigo-600 hover:underline">
                        {aso.patient.fullName}
                      </Link>
                      {aso.patient.currentJobTitle && (
                        <p className="text-xs text-gray-400">{aso.patient.currentJobTitle}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {aso.company ? (aso.company.tradeName || aso.company.legalName) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">
                        {EXAM_LABELS[aso.examType] || aso.examType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${CONCLUSION_STYLES[aso.conclusion]}`}>
                        {CONCLUSION_LABELS[aso.conclusion] || aso.conclusion}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {format(new Date(aso.issuedAt), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {aso.validUntil ? format(new Date(aso.validUntil), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      Dr(a). {aso.doctor.fullName}
                      {aso.doctor.crmNumber && (
                        <span className="text-gray-400"> · CRM {aso.doctor.crmNumber}/{aso.doctor.crmState}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/asos/${aso.id}`}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Total: {total} ASOs</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Anterior
              </button>
              <span className="px-3 py-1 text-sm text-gray-600">{page}/{totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

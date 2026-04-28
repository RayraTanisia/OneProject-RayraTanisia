import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { ClipboardList, Loader2, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import dayjs from 'dayjs'

const typeLabel: Record<string, string> = {
  INITIAL: 'Inicial', PERIODIC: 'Periódico', DISMISSAL: 'Demissional',
  ASO: 'ASO', FOLLOWUP: 'Acompanhamento', RETURN: 'Retorno',
}

export default function MedicalRecordsListPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  function handleSearch(v: string) {
    setSearch(v)
    clearTimeout((window as any)._mrTimer)
    ;(window as any)._mrTimer = setTimeout(() => { setDebouncedSearch(v); setPage(1) }, 400)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['medical-records', page, debouncedSearch],
    queryFn: () =>
      api.get('/appointments/medical-records', {
        params: { page, limit, search: debouncedSearch || undefined },
      }).then(r => r.data),
  })

  const records = data?.data || []
  const meta = data?.meta || {}

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1>Prontuários</h1>
          <p className="text-gray-500 text-sm mt-0.5">{meta.total ?? 0} prontuários finalizados</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por paciente ou médico..."
            className="input pl-9 max-w-md"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-20">
            <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Nenhum prontuário encontrado</p>
            <p className="text-gray-400 text-sm mt-1">
              {debouncedSearch
                ? 'Tente buscar com outros termos.'
                : 'Prontuários finalizados aparecerão aqui.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th>Médico</th>
                  <th>Empresa</th>
                  <th>Tipo</th>
                  <th>Diagnóstico</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r: any) => {
                  const notes = r.parsedNotes || {}
                  const diags: any[] = notes.diagnoses || []
                  const primary = diags[0]
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap text-sm text-gray-600">
                        {dayjs(r.scheduledAt).format('DD/MM/YYYY')}
                        <span className="block text-xs text-gray-400">{dayjs(r.scheduledAt).format('HH:mm')}</span>
                      </td>
                      <td>
                        <Link
                          to={`/patients/${r.patientId}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {r.patient?.fullName}
                        </Link>
                        {r.patient?.birthDate && (
                          <span className="block text-xs text-gray-400">
                            {dayjs().diff(dayjs(r.patient.birthDate), 'year')} anos
                          </span>
                        )}
                      </td>
                      <td className="text-gray-600 text-sm">{r.doctor?.fullName}</td>
                      <td className="text-gray-500 text-sm">
                        {r.company?.tradeName || r.company?.legalName || '—'}
                      </td>
                      <td>
                        <span className="badge bg-gray-100 text-gray-600 text-xs">
                          {typeLabel[r.appointmentType] || r.appointmentType}
                        </span>
                      </td>
                      <td className="text-sm">
                        {primary ? (
                          <span className="text-gray-700">
                            <span className="font-mono text-blue-600 mr-1">{primary.code}</span>
                            <span className="text-gray-500">{primary.description}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td>
                        <Link
                          to={`/appointments/${r.id}/medical-record`}
                          className="btn-ghost btn-sm text-xs"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Página {page} de {meta.totalPages} · {meta.total} resultados
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="btn-secondary btn-sm disabled:opacity-50"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="btn-secondary btn-sm disabled:opacity-50"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

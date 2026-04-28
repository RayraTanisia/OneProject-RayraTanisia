import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { patientService } from '../../lib/patients'
import { Search, Plus, User, Building2, Loader2 } from 'lucide-react'
import dayjs from 'dayjs'

export default function PatientListPage() {
  const [search, setSearch] = useState('')

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => patientService.list(search || undefined),
    staleTime: 10_000,
  })

  const active = patients.filter(p => p.status === 'ACTIVE')

  function calcAge(birth?: string) {
    if (!birth) return '—'
    return dayjs().diff(dayjs(birth), 'year') + ' anos'
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pacientes</h1>
          <p className="text-gray-500 text-sm mt-0.5">{active.length} ativos</p>
        </div>
        <Link to="/patients/new" className="btn-primary"><Plus size={16} /> Novo paciente</Link>
      </div>

      <div className="card p-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, CPF ou cargo..." className="input pl-9" />
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 size={26} className="animate-spin text-blue-500" /></div>
        ) : patients.length === 0 ? (
          <div className="text-center py-20">
            <User size={38} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">{search ? 'Nenhum resultado' : 'Nenhum paciente cadastrado'}</p>
            {!search && <Link to="/patients/new" className="btn-primary inline-flex mt-4 btn-sm"><Plus size={13} /> Novo paciente</Link>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Paciente</th><th>Idade</th><th>Empresa</th><th>Função</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.id} className="cursor-pointer" onClick={() => window.location.href = '/patients/' + p.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                          {p.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{p.fullName}</p>
                          {p.cpf && <p className="text-xs text-gray-400">{p.cpf}</p>}
                        </div>
                      </div>
                    </td>
                    <td>{calcAge(p.birthDate)}</td>
                    <td>
                      {p.currentCompanyName
                        ? <span className="flex items-center gap-1 text-gray-600"><Building2 size={11} className="text-gray-400" />{p.currentCompanyName}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="text-gray-600">{p.currentJobTitle || <span className="text-gray-300">—</span>}</td>
                    <td>
                      <span className={`badge text-xs ${p.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <Link to={'/patients/' + p.id} className="btn-ghost btn-sm" onClick={e => e.stopPropagation()}>Ver</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

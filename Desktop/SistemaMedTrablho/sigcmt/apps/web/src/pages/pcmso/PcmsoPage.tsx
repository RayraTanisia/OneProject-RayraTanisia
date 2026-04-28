import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'
import {
  FileText, Upload, Download, Copy, Loader2, CheckCircle,
  XCircle, AlertTriangle, ChevronDown, ChevronUp, Activity,
  Building2, Users, Save, ClipboardCheck, ExternalLink, Stethoscope, BookOpen,
} from 'lucide-react'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS = [
  { value: 'pcmso_completo',        label: 'PCMSO Completo (NR-7)',     desc: 'Empresa, médicos, todos os GHEs com riscos e exames' },
  { value: 'funcoes_riscos_exames', label: 'Funções + Riscos + Exames', desc: 'Cargos, riscos por tipo, exames com CBO e código eSocial' },
  { value: 'exames_cargo',          label: 'Exames por Cargo',          desc: 'Exames por cargo separados por momento (adm, per, dem...)' },
  { value: 'riscos_ocupacionais',   label: 'Riscos Ocupacionais',       desc: 'Riscos por função: tipo, exposição e danos à saúde' },
  { value: 'empresa_medico',        label: 'Empresa + Médico',          desc: 'CNPJ, CNAE, grau de risco, médico responsável, CRM' },
  { value: 'aso',                   label: 'ASO — Dados do Paciente',   desc: 'Nome, CPF, CBO, exame físico, aptidão, validade' },
  { value: 'personalizado',         label: 'Personalizado',             desc: 'Descreva em linguagem natural o que deseja extrair' },
]

const RISCO_COLORS: Record<string, string> = {
  'Físico':             'bg-yellow-100 text-yellow-800',
  'Químico':            'bg-purple-100 text-purple-800',
  'Biológico':          'bg-green-100 text-green-800',
  'Ergonômico':         'bg-blue-100 text-blue-800',
  'Mecânico-Acidentes': 'bg-red-100 text-red-800',
  'Acidente':           'bg-red-100 text-red-800',
}

// ─── Interfaces da Ficha ──────────────────────────────────────────────────────

interface FichaEmpresa {
  // Identificação
  legalName: string; cnpj: string; cpfTitular: string; tradeName: string
  inscricaoEstadual: string; representanteLegal: string
  // Atividade
  cnae: string; descricaoCnae: string; riskLevel: string; employeeCount: string; sector: string
  // Contato
  phone: string; email: string
  // Endereço
  street: string; bairro: string; city: string; state: string; zip: string
}

interface FichaConsultoria {
  razaoSocial: string; cnpj: string; endereco: string
  cidade: string; estado: string; telefone: string; email: string; responsavelLegal: string
}

interface FichaMedico {
  nome: string; crm: string; cpf: string; cargo: string
}

interface FichaDocumento {
  tipo: string; revisao: string; dataElaboracao: string; periodoInicio: string; periodoFim: string
}

interface FichaPaciente {
  // Identificação
  fullName: string; cpf: string; rg: string; birthDate: string; gender: string
  // Ocupacional
  funcao: string; cbo: string; setor: string; matricula: string; dataAdmissao: string
  // Contato
  phone: string; email: string
  // ASO
  aptidao: string; restricoes: string; validadeAso: string; dataProximoExame: string
}

const emptyEmpresa   = (): FichaEmpresa    => ({ legalName: '', cnpj: '', cpfTitular: '', tradeName: '', inscricaoEstadual: '', representanteLegal: '', cnae: '', descricaoCnae: '', riskLevel: '1', employeeCount: '', sector: '', phone: '', email: '', street: '', bairro: '', city: '', state: '', zip: '' })
const emptyConsult   = (): FichaConsultoria => ({ razaoSocial: '', cnpj: '', endereco: '', cidade: '', estado: '', telefone: '', email: '', responsavelLegal: '' })
const emptyMedico    = (): FichaMedico      => ({ nome: '', crm: '', cpf: '', cargo: '' })
const emptyDocumento = (): FichaDocumento   => ({ tipo: '', revisao: '', dataElaboracao: '', periodoInicio: '', periodoFim: '' })
const emptyPaciente  = (): FichaPaciente    => ({ fullName: '', cpf: '', rg: '', birthDate: '', gender: '', funcao: '', cbo: '', setor: '', matricula: '', dataAdmissao: '', phone: '', email: '', aptidao: '', restricoes: '', validadeAso: '', dataProximoExame: '' })

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function F({ label, value, onChange, type = 'text', span2 = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; span2?: boolean
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="label">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="input" />
    </div>
  )
}

function Section({ icon: Icon, title, color = 'blue', children }: {
  icon: any; title: string; color?: string; children: React.ReactNode
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-500', green: 'text-green-500', purple: 'text-purple-500', orange: 'text-orange-500'
  }
  return (
    <div className="card">
      <div className="card-header flex items-center gap-2">
        <Icon size={16} className={colors[color] || colors.blue} />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  )
}

function toIsoDate(d: string | undefined | null): string {
  if (!d) return ''
  const trimmed = d.trim()
  // Já está em formato ISO ou prefixo ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  // Formato brasileiro DD/MM/AAAA
  const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return trimmed
}

function check(v: unknown) {
  return v
    ? <CheckCircle size={13} className="text-green-500 mx-auto" />
    : <span className="text-gray-200 text-xs block text-center">—</span>
}

function InfoGrid({ items }: { items: [string, unknown][] }) {
  const filtered = items.filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 0)
  if (filtered.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
      {filtered.map(([label, value]) => (
        <div key={label} className="flex gap-2 py-1 border-b border-gray-50 last:border-0">
          <span className="text-xs text-gray-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
          <span className="text-sm text-gray-800">{String(value)}</span>
        </div>
      ))}
    </div>
  )
}

function GheBlock({ ghe }: { ghe: any }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-blue-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-gray-800 text-sm">{ghe.ghe || ghe.cargo || ghe.funcao}</p>
            {ghe.funcao && ghe.funcao !== ghe.ghe && <p className="text-xs text-gray-400">{ghe.funcao}{ghe.cbo ? ` · CBO ${ghe.cbo}` : ''}</p>}
            {!ghe.funcao && ghe.cbo && <p className="text-xs text-gray-400">CBO {ghe.cbo}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ghe.quantidade_empregados > 0 && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{ghe.quantidade_empregados} func.</span>}
          {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="p-4 space-y-4">
          {ghe.descricao_atividades && <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">{ghe.descricao_atividades}</p>}
          {ghe.riscos?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Riscos</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100"><th className="text-left py-1 pr-3 text-gray-400 font-medium">Risco</th><th className="text-left py-1 pr-3 text-gray-400 font-medium">Tipo</th><th className="text-left py-1 pr-3 text-gray-400 font-medium">Exposição</th><th className="text-left py-1 text-gray-400 font-medium">Danos</th></tr></thead>
                  <tbody>
                    {ghe.riscos.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 pr-3 text-gray-700">{r.risco}</td>
                        <td className="py-1.5 pr-3"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${RISCO_COLORS[r.tipo_risco] || 'bg-gray-100 text-gray-600'}`}>{r.tipo_risco}</span></td>
                        <td className="py-1.5 pr-3 text-gray-500">{r.tipo_exposicao}</td>
                        <td className="py-1.5 text-gray-500">{r.danos_saude}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {ghe.exames?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Exames</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100"><th className="text-left py-1 pr-3 text-gray-400 font-medium">Exame</th><th className="text-left py-1 pr-2 text-gray-400 font-medium">eSocial</th><th className="text-center py-1 px-1 text-gray-400 font-medium">Adm</th><th className="text-center py-1 px-1 text-gray-400 font-medium">Dem</th><th className="text-center py-1 px-1 text-gray-400 font-medium">Per</th><th className="text-center py-1 px-1 text-gray-400 font-medium">Ret</th><th className="text-center py-1 px-1 text-gray-400 font-medium">Mud</th><th className="text-left py-1 pl-2 text-gray-400 font-medium">Periodicidade</th></tr></thead>
                  <tbody>
                    {ghe.exames.map((e: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 pr-3 text-gray-700">{e.nome}</td>
                        <td className="py-1.5 pr-2">{e.codigo_esocial && <span className="bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded text-[10px] font-mono">{e.codigo_esocial}</span>}</td>
                        <td className="py-1.5 px-1">{check(e.admissional)}</td>
                        <td className="py-1.5 px-1">{check(e.demissional)}</td>
                        <td className="py-1.5 px-1">{check(e.periodico)}</td>
                        <td className="py-1.5 px-1">{check(e.retorno_trabalho)}</td>
                        <td className="py-1.5 px-1">{check(e.mudanca_risco)}</td>
                        <td className="py-1.5 pl-2 text-gray-400">{e.periodicidade && <span className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">{e.periodicidade}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Visualização por tipo ────────────────────────────────────────────────────

function VisualResult({ data, tipo }: { data: Record<string, unknown>; tipo: string }) {
  if (tipo === 'aso') {
    const p = (data.paciente as any) || {}; const ef = (data.exame_fisico as any) || {}
    const apt = (data.aptidao as any) || {}; const med = (data.medico as any) || {}
    const emp = (data.empresa as any) || {}; const exames: any[] = (data.exames_complementares as any[]) || []
    const isApto = apt.resultado?.toUpperCase().includes('APTO') && !apt.resultado?.toUpperCase().includes('INAPTO')
    const isInapto = apt.resultado?.toUpperCase().includes('INAPTO')
    return (
      <div className="space-y-4">
        {apt.resultado && (
          <div className={`rounded-xl p-4 flex items-center gap-3 border ${isInapto ? 'bg-red-50 border-red-200' : isApto ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
            {isInapto ? <XCircle size={22} className="text-red-500" /> : isApto ? <CheckCircle size={22} className="text-green-500" /> : <AlertTriangle size={22} className="text-yellow-500" />}
            <div>
              <p className={`font-bold text-lg ${isInapto ? 'text-red-700' : isApto ? 'text-green-700' : 'text-yellow-700'}`}>{apt.resultado}</p>
              {apt.restricoes && <p className="text-sm text-gray-600 mt-0.5">{apt.restricoes}</p>}
              {apt.validade && <p className="text-xs text-gray-500 mt-1">Validade: {apt.validade}{apt.data_proximo_exame ? ` · Próximo: ${apt.data_proximo_exame}` : ''}</p>}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Dados do Paciente</p>
            <InfoGrid items={[['Nome', p.nome], ['CPF', p.cpf], ['RG', p.rg], ['Nascimento', p.data_nascimento], ['Sexo', p.sexo], ['Função', p.funcao], ['CBO', p.cbo], ['Setor', p.setor], ['Matrícula', p.matricula], ['Admissão', p.data_admissao]]} />
          </div>
          <div className="space-y-4">
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Exame Físico</p>
              <InfoGrid items={[['Altura', ef.altura], ['Peso', ef.peso], ['IMC', ef.imc], ['Pressão Arterial', ef.pressao_arterial], ['FC', ef.frequencia_cardiaca], ['Acuidade OD', ef.acuidade_visual_od], ['Acuidade OE', ef.acuidade_visual_oe]]} />
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Médico / Empresa</p>
              <InfoGrid items={[['Médico', med.nome], ['CRM', med.crm], ['Empresa', emp.razao_social], ['CNPJ', emp.cnpj]]} />
            </div>
          </div>
        </div>
        {exames.length > 0 && (
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Exames Complementares</p>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100"><th className="text-left py-1 pr-4 text-gray-400 font-medium text-xs">Exame</th><th className="text-left py-1 pr-4 text-gray-400 font-medium text-xs">Resultado</th><th className="text-left py-1 text-gray-400 font-medium text-xs">Data</th></tr></thead>
              <tbody>{exames.map((e: any, i: number) => <tr key={i} className="border-b border-gray-50 last:border-0"><td className="py-1.5 pr-4 text-gray-700">{e.nome}</td><td className="py-1.5 pr-4 text-gray-600">{e.resultado}</td><td className="py-1.5 text-gray-400 text-xs">{e.data}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  if (tipo === 'empresa_medico') {
    const emp = (data.empresa as any) || {}; const cons = (data.consultoria as any) || {}
    const med = (data.medico_responsavel as any) || (data.medicos as any)?.responsavel_pcmso || {}
    const doc = (data.documento as any) || {}
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Empresa</p>
          <InfoGrid items={[['Razão Social', emp.razao_social], ['Nome Fantasia', emp.nome_fantasia], ['CNPJ', emp.cnpj], ['CPF Titular', emp.cpf], ['CNAE', emp.cnae], ['Atividade', emp.descricao_cnae], ['Grau de Risco', emp.grau_risco], ['Funcionários', emp.numero_empregados], ['Insc. Estadual', emp.inscricao_estadual], ['Representante', emp.representante_legal], ['Bairro', emp.bairro], ['Cidade/UF', emp.cidade ? `${emp.cidade}/${emp.estado}` : null], ['CEP', emp.cep], ['Telefone', emp.telefone], ['E-mail', emp.email]]} />
        </div>
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Médico Responsável</p>
            <InfoGrid items={[['Nome', med.nome], ['CRM', med.crm], ['CPF', med.cpf], ['Cargo', med.cargo]]} />
          </div>
          {cons.razao_social && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Consultoria</p>
              <InfoGrid items={[['Empresa', cons.razao_social], ['CNPJ', cons.cnpj], ['Responsável', cons.responsavel_legal], ['Cidade', cons.cidade], ['Telefone', cons.telefone], ['E-mail', cons.email]]} />
            </div>
          )}
          {doc.tipo && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Documento</p>
              <InfoGrid items={[['Tipo', doc.tipo], ['Revisão', doc.revisao], ['Elaboração', doc.data_elaboracao], ['Vigência', doc.periodo_inicio ? `${doc.periodo_inicio} → ${doc.periodo_fim}` : null]]} />
            </div>
          )}
        </div>
      </div>
    )
  }

  const ghes: any[] = (data.grupos_homogeneos_exposicao as any[]) || (data.cargos as any[]) || (data.riscos_por_ghe as any[]) || []
  const emp = data.empresa as any
  const empNome = typeof emp === 'string' ? emp : emp?.razao_social || emp?.nome_fantasia
  const med = (data.medicos as any)?.responsavel_pcmso || {}

  return (
    <div className="space-y-4">
      {(empNome || med.nome) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {emp && typeof emp === 'object' && emp.razao_social && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Empresa</p>
              <InfoGrid items={[['Razão Social', emp.razao_social], ['CNPJ', emp.cnpj], ['CNAE', emp.cnae], ['Grau de Risco', emp.grau_risco], ['Funcionários', emp.numero_empregados]]} />
            </div>
          )}
          {empNome && typeof emp === 'string' && (
            <div className="card p-4"><p className="text-xs font-semibold text-gray-400 uppercase mb-2">Empresa</p><p className="text-sm font-semibold text-gray-800">{empNome}</p></div>
          )}
          {med.nome && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Médico Responsável</p>
              <InfoGrid items={[['Nome', med.nome], ['CRM', med.crm], ['Cargo', med.cargo]]} />
            </div>
          )}
        </div>
      )}
      {ghes.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">{ghes.length} {ghes.length === 1 ? 'grupo/cargo' : 'grupos/cargos'} encontrado{ghes.length !== 1 ? 's' : ''}</p>
          {ghes.map((ghe: any, i: number) => <GheBlock key={i} ghe={ghe} />)}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-400">
          <FileText size={36} className="mx-auto mb-2 text-gray-200" />
          <p className="text-sm">Nenhum grupo/cargo encontrado nos dados extraídos.</p>
        </div>
      )}
    </div>
  )
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

function generateCsv(data: Record<string, unknown>, tipo: string): string {
  const BOM = '﻿'
  const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const rows: string[][] = []
  const ghes: any[] = (data.grupos_homogeneos_exposicao as any[]) || (data.cargos as any[]) || (data.riscos_por_ghe as any[]) || []

  if (tipo === 'riscos_ocupacionais') {
    rows.push(['GHE', 'Função', 'CBO', 'Risco', 'Tipo', 'Exposição', 'Danos'])
    ghes.forEach((g: any) => (g.riscos || []).forEach((r: any) =>
      rows.push([g.ghe || g.funcao, g.funcao, g.cbo, r.risco, r.tipo_risco, r.tipo_exposicao, r.danos_saude].map(esc))
    ))
  } else if (tipo === 'aso') {
    const p = (data.paciente as any) || {}; const ef = (data.exame_fisico as any) || {}; const apt = (data.aptidao as any) || {}
    rows.push(['Campo', 'Valor'])
    ;[['Nome', p.nome], ['CPF', p.cpf], ['Função', p.funcao], ['CBO', p.cbo], ['Altura', ef.altura], ['Peso', ef.peso], ['Pressão', ef.pressao_arterial], ['Aptidão', apt.resultado], ['Validade', apt.validade]].forEach(r => rows.push(r.map(esc)))
  } else {
    rows.push(['GHE', 'Função', 'CBO', 'Qtd Func.', 'Exame', 'Cód eSocial', 'Adm', 'Dem', 'Per', 'Ret', 'Mud', 'Periodicidade', 'Obs'])
    ghes.forEach((g: any) => {
      const exames: any[] = g.exames || []
      if (exames.length === 0) {
        rows.push([g.ghe || g.cargo, g.funcao || g.cargo, g.cbo, g.quantidade_empregados, '', '', '', '', '', '', '', '', ''].map(esc))
      } else {
        exames.forEach((e: any) => rows.push([
          g.ghe || g.cargo || '', g.funcao || g.cargo || '', g.cbo || '',
          g.quantidade_empregados ?? '', e.nome || '', e.codigo_esocial || '',
          e.admissional ? 'Sim' : 'Não', e.demissional ? 'Sim' : 'Não',
          e.periodico ? 'Sim' : 'Não', e.retorno_trabalho ? 'Sim' : 'Não',
          e.mudanca_risco ? 'Sim' : 'Não', e.periodicidade || '', e.obs || '',
        ].map(esc)))
      }
    })
  }
  return BOM + rows.map(r => r.join(',')).join('\r\n')
}

// ─── Preencher ficha a partir dos resultados ──────────────────────────────────

function buildFichaFromResults(results: any[]) {
  const empresa    = emptyEmpresa()
  const consultoria = emptyConsult()
  const medico     = emptyMedico()
  const documento  = emptyDocumento()
  const paciente   = emptyPaciente()

  for (const r of results) {
    if (!r.data) continue

    // Empresa
    const emp = r.data.empresa
    if (emp && typeof emp === 'object') {
      if (emp.razao_social      && !empresa.legalName)          empresa.legalName          = emp.razao_social
      if (emp.cnpj              && !empresa.cnpj)               empresa.cnpj               = emp.cnpj
      if (emp.cpf               && !empresa.cpfTitular)         empresa.cpfTitular         = emp.cpf
      if (emp.nome_fantasia     && !empresa.tradeName)          empresa.tradeName          = emp.nome_fantasia
      if (emp.inscricao_estadual && !empresa.inscricaoEstadual) empresa.inscricaoEstadual  = emp.inscricao_estadual
      if (emp.representante_legal && !empresa.representanteLegal) empresa.representanteLegal = emp.representante_legal
      if (emp.cnae              && !empresa.cnae)               empresa.cnae               = emp.cnae
      if (emp.descricao_cnae    && !empresa.descricaoCnae)      empresa.descricaoCnae      = emp.descricao_cnae
      if (emp.grau_risco        && !empresa.riskLevel)          empresa.riskLevel          = String(emp.grau_risco).replace(/[^1-4]/g, '') || '1'
      if (emp.numero_empregados && !empresa.employeeCount)      empresa.employeeCount      = String(emp.numero_empregados)
      if (emp.telefone          && !empresa.phone)              empresa.phone              = emp.telefone
      if (emp.email             && !empresa.email)              empresa.email              = emp.email
      if (emp.endereco          && !empresa.street)             empresa.street             = emp.endereco
      if (emp.bairro            && !empresa.bairro)             empresa.bairro             = emp.bairro
      if (emp.cidade            && !empresa.city)               empresa.city               = emp.cidade
      if (emp.estado            && !empresa.state)              empresa.state              = emp.estado
      if (emp.cep               && !empresa.zip)                empresa.zip                = emp.cep
    }

    // Consultoria
    const cons = r.data.consultoria
    if (cons && typeof cons === 'object') {
      if (cons.razao_social      && !consultoria.razaoSocial)     consultoria.razaoSocial     = cons.razao_social
      if (cons.cnpj              && !consultoria.cnpj)            consultoria.cnpj            = cons.cnpj
      if (cons.endereco          && !consultoria.endereco)        consultoria.endereco        = cons.endereco
      if (cons.cidade            && !consultoria.cidade)          consultoria.cidade          = cons.cidade
      if (cons.estado            && !consultoria.estado)          consultoria.estado          = cons.estado
      if (cons.telefone          && !consultoria.telefone)        consultoria.telefone        = cons.telefone
      if (cons.email             && !consultoria.email)           consultoria.email           = cons.email
      if (cons.responsavel_legal && !consultoria.responsavelLegal) consultoria.responsavelLegal = cons.responsavel_legal
    }

    // Médico
    const med = r.data.medicos?.responsavel_pcmso || r.data.medico_responsavel
    if (med && typeof med === 'object') {
      if (med.nome  && !medico.nome)  medico.nome  = med.nome
      if (med.crm   && !medico.crm)   medico.crm   = med.crm
      if (med.cpf   && !medico.cpf)   medico.cpf   = med.cpf
      if (med.cargo && !medico.cargo) medico.cargo = med.cargo
    }

    // Documento
    const doc = r.data.documento
    if (doc && typeof doc === 'object') {
      if (doc.tipo             && !documento.tipo)            documento.tipo            = doc.tipo
      if (doc.revisao          && !documento.revisao)         documento.revisao         = doc.revisao
      if (doc.data_elaboracao  && !documento.dataElaboracao)  documento.dataElaboracao  = doc.data_elaboracao
      if (doc.periodo_inicio   && !documento.periodoInicio)   documento.periodoInicio   = doc.periodo_inicio
      if (doc.periodo_fim      && !documento.periodoFim)      documento.periodoFim      = doc.periodo_fim
    }

    // Paciente (ASO)
    if (r.tipo === 'aso' && r.data.paciente) {
      const p = r.data.paciente
      const apt = r.data.aptidao || {}
      if (p.nome             && !paciente.fullName)         paciente.fullName         = p.nome
      if (p.cpf              && !paciente.cpf)              paciente.cpf              = p.cpf
      if (p.rg               && !paciente.rg)               paciente.rg               = p.rg
      if (p.data_nascimento  && !paciente.birthDate)        paciente.birthDate        = toIsoDate(p.data_nascimento)
      if (p.sexo             && !paciente.gender) {
        const s = p.sexo?.toLowerCase()
        paciente.gender = s === 'f' || s === 'feminino' ? 'female' : s === 'm' || s === 'masculino' ? 'male' : ''
      }
      if (p.funcao           && !paciente.funcao)           paciente.funcao           = p.funcao
      if (p.cbo              && !paciente.cbo)              paciente.cbo              = p.cbo
      if (p.setor            && !paciente.setor)            paciente.setor            = p.setor
      if (p.matricula        && !paciente.matricula)        paciente.matricula        = p.matricula
      if (p.data_admissao    && !paciente.dataAdmissao)     paciente.dataAdmissao     = p.data_admissao
      if (apt.resultado      && !paciente.aptidao)          paciente.aptidao          = apt.resultado
      if (apt.restricoes     && !paciente.restricoes)       paciente.restricoes       = apt.restricoes
      if (apt.validade       && !paciente.validadeAso)      paciente.validadeAso      = apt.validade
      if (apt.data_proximo_exame && !paciente.dataProximoExame) paciente.dataProximoExame = apt.data_proximo_exame
    }
  }

  return { empresa, consultoria, medico, documento, paciente }
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function PcmsoPage() {
  const navigate = useNavigate()

  // Estado de extração
  const [file, setFile]                   = useState<File | null>(null)
  const [selectedTipos, setSelectedTipos] = useState<string[]>(['pcmso_completo'])
  const [instrucao, setInstrucao]         = useState('')
  const [loading, setLoading]             = useState(false)
  const [results, setResults]             = useState<any[]>([])
  const [meta, setMeta]                   = useState<any>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [activeResultTab, setActiveResultTab] = useState(0)
  const [activeViewTab, setActiveViewTab] = useState<'visual' | 'json'>('visual')
  const [dragging, setDragging]           = useState(false)
  const inputRef                          = useRef<HTMLInputElement>(null)

  // Abas principais
  const [mainTab, setMainTab] = useState<'extracao' | 'ficha'>('extracao')

  // Estado da ficha
  const [fichaEmpresa,    setFichaEmpresa]    = useState<FichaEmpresa>(emptyEmpresa())
  const [fichaConsultoria,setFichaConsultoria]= useState<FichaConsultoria>(emptyConsult())
  const [fichaMedico,     setFichaMedico]     = useState<FichaMedico>(emptyMedico())
  const [fichaDocumento,  setFichaDocumento]  = useState<FichaDocumento>(emptyDocumento())
  const [fichaPaciente,   setFichaPaciente]   = useState<FichaPaciente>(emptyPaciente())
  const [fichaPreenchida, setFichaPreenchida] = useState(false)
  const [saving, setSaving]                   = useState(false)
  const [savedIds, setSavedIds]               = useState<{ companyId?: string; patientId?: string } | null>(null)

  const setEmp  = (f: keyof FichaEmpresa)    => (v: string) => setFichaEmpresa   (e => ({ ...e, [f]: v }))
  const setCons = (f: keyof FichaConsultoria) => (v: string) => setFichaConsultoria(e => ({ ...e, [f]: v }))
  const setMed  = (f: keyof FichaMedico)     => (v: string) => setFichaMedico    (e => ({ ...e, [f]: v }))
  const setDoc  = (f: keyof FichaDocumento)  => (v: string) => setFichaDocumento (e => ({ ...e, [f]: v }))
  const setPac  = (f: keyof FichaPaciente)   => (v: string) => setFichaPaciente  (e => ({ ...e, [f]: v }))

  const toggleTipo = (value: string) =>
    setSelectedTipos(prev => prev.includes(value) ? (prev.length > 1 ? prev.filter(t => t !== value) : prev) : [...prev, value])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.type === 'application/pdf') { setFile(f); setResults([]); setError(null) }
    else toast.error('Envie apenas arquivos PDF.')
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setResults([]); setError(null) }
  }

  async function handleExtract() {
    if (!file) { toast.error('Selecione um arquivo PDF.'); return }
    if (selectedTipos.includes('personalizado') && !instrucao.trim()) { toast.error('Descreva o que deseja extrair.'); return }
    setLoading(true); setError(null); setResults([])
    try {
      const form = new FormData()
      form.append('tipos', JSON.stringify(selectedTipos))
      form.append('instrucao', instrucao)
      form.append('file', file)
      const res = await api.post('/pcmso/extract', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300_000 })
      const extracted: any[] = res.data.results || []
      setResults(extracted); setMeta(res.data.meta); setActiveResultTab(0); setActiveViewTab('visual')

      const ficha = buildFichaFromResults(extracted)
      setFichaEmpresa(ficha.empresa); setFichaConsultoria(ficha.consultoria)
      setFichaMedico(ficha.medico); setFichaDocumento(ficha.documento); setFichaPaciente(ficha.paciente)
      setSavedIds(null)

      const preenchida = ficha.empresa.legalName !== '' || ficha.paciente.fullName !== ''
      setFichaPreenchida(preenchida)

      const ok = extracted.filter((r: any) => !r.error).length
      toast.success(`${ok} extração(ões) concluída(s)!${preenchida ? ' Ficha preenchida automaticamente.' : ''}`)
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Erro ao processar o documento.'
      setError(msg); toast.error(msg)
    } finally { setLoading(false) }
  }

  async function handleSaveFicha() {
    const temEmpresa  = fichaEmpresa.legalName.trim() !== ''
    const temPaciente = fichaPaciente.fullName.trim() !== ''
    if (!temEmpresa && !temPaciente) { toast.error('Preencha ao menos a empresa ou o paciente.'); return }
    setSaving(true)
    let companyId: string | undefined
    let patientId: string | undefined
    try {
      if (temEmpresa) {
        try {
          // Se não tem CNPJ mas tem CPF de produtor individual, usa o CPF
          const cnpjOuCpf = (fichaEmpresa.cnpj || fichaEmpresa.cpfTitular).replace(/\D/g, '')
          const payload: any = {
            legalName:     fichaEmpresa.legalName,
            tradeName:     fichaEmpresa.tradeName      || undefined,
            cnae:          fichaEmpresa.cnae           || undefined,
            riskLevel:     Number(fichaEmpresa.riskLevel) || 1,
            employeeCount: fichaEmpresa.employeeCount  ? Number(fichaEmpresa.employeeCount) : undefined,
            phone:         fichaEmpresa.phone          || undefined,
            email:         fichaEmpresa.email          || undefined,
            sector:        fichaEmpresa.descricaoCnae  || fichaEmpresa.sector || undefined,
            status:        'ACTIVE',
            address: {
              street:              fichaEmpresa.street             || undefined,
              neighborhood:        fichaEmpresa.bairro             || undefined,
              city:                fichaEmpresa.city               || undefined,
              state:               fichaEmpresa.state              || undefined,
              zip:                 fichaEmpresa.zip                || undefined,
              // Campos extras salvos no JSON de endereço
              cpf_titular:         fichaEmpresa.cpfTitular         || undefined,
              inscricao_estadual:  fichaEmpresa.inscricaoEstadual  || undefined,
              representante_legal: fichaEmpresa.representanteLegal || undefined,
              // Consultoria
              consultoria_razao_social:  fichaConsultoria.razaoSocial      || undefined,
              consultoria_cnpj:          fichaConsultoria.cnpj             || undefined,
              consultoria_responsavel:   fichaConsultoria.responsavelLegal || undefined,
              consultoria_telefone:      fichaConsultoria.telefone         || undefined,
              consultoria_email:         fichaConsultoria.email            || undefined,
              // Médico responsável
              medico_responsavel:        fichaMedico.nome  || undefined,
              medico_crm:                fichaMedico.crm   || undefined,
              medico_cpf:                fichaMedico.cpf   || undefined,
              medico_cargo:              fichaMedico.cargo || undefined,
              // Documento
              pcmso_tipo:                fichaDocumento.tipo            || undefined,
              pcmso_revisao:             fichaDocumento.revisao         || undefined,
              pcmso_data_elaboracao:     fichaDocumento.dataElaboracao  || undefined,
              pcmso_periodo_inicio:      fichaDocumento.periodoInicio   || undefined,
              pcmso_periodo_fim:         fichaDocumento.periodoFim      || undefined,
            },
          }
          if (cnpjOuCpf) payload.cnpj = cnpjOuCpf
          const res = await api.post('/companies', payload)
          companyId = res.data.data?.id
          toast.success('Empresa cadastrada!')
        } catch (e: any) {
          const msg = e?.response?.data?.error?.message || ''
          if (e?.response?.status === 409 || msg.toLowerCase().includes('já cadastrad') || msg.toLowerCase().includes('unique')) {
            try {
              const cnpjOuCpf = (fichaEmpresa.cnpj || fichaEmpresa.cpfTitular).replace(/\D/g, '')
              if (cnpjOuCpf) {
                const busca = await api.get('/companies', { params: { search: cnpjOuCpf, limit: 1 } })
                companyId = busca.data.data?.[0]?.id
              }
            } catch { /* ignora */ }
            toast('Empresa já cadastrada — vinculando ao paciente.', { icon: 'ℹ️' })
          } else {
            toast.error(`Erro ao salvar empresa: ${msg || 'tente novamente.'}`)
          }
        }
      }

      if (temPaciente) {
        try {
          const cpfLimpo = fichaPaciente.cpf.replace(/\D/g, '')
          if (!cpfLimpo || cpfLimpo.length < 11) {
            toast('CPF do paciente não encontrado — preencha o campo CPF antes de salvar.', { icon: '⚠️' })
            setSaving(false)
            return
          }
          const payload: any = {
            fullName:         fichaPaciente.fullName,
            rg:               fichaPaciente.rg            || undefined,
            birthDate:        fichaPaciente.birthDate      || undefined,
            gender:           fichaPaciente.gender         || undefined,
            phone:            fichaPaciente.phone          || undefined,
            email:            fichaPaciente.email          || undefined,
            currentJobTitle:  fichaPaciente.funcao         || undefined,
            currentCompanyId: companyId                    || undefined,
            lgpdConsent:      { consented: true, channels: ['email'] },
            // Dados extras no customFields
            customFields: {
              cbo:               fichaPaciente.cbo              || undefined,
              setor:             fichaPaciente.setor            || undefined,
              matricula:         fichaPaciente.matricula        || undefined,
              data_admissao:     fichaPaciente.dataAdmissao     || undefined,
              aptidao_aso:       fichaPaciente.aptidao          || undefined,
              restricoes_aso:    fichaPaciente.restricoes       || undefined,
              validade_aso:      fichaPaciente.validadeAso      || undefined,
              proximo_exame_aso: fichaPaciente.dataProximoExame || undefined,
            },
          }
          if (cpfLimpo) payload.cpf = cpfLimpo
          const res = await api.post('/patients', payload)
          patientId = res.data.data?.id
          toast.success('Paciente cadastrado!')
        } catch (e: any) {
          const msg = e?.response?.data?.error?.message || ''
          toast.error(`Erro ao salvar paciente: ${msg || 'tente novamente.'}`)
        }
      }

      if (companyId || patientId) setSavedIds({ companyId, patientId })
    } finally { setSaving(false) }
  }

  function downloadCsv(result: any) {
    if (!result?.data) return
    const name = (file?.name || 'doc').replace('.pdf', '')
    const csv = generateCsv(result.data, result.tipo)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `${name}_${result.tipo}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function downloadJson(result: any) {
    if (!result?.data) return
    const name = (file?.name || 'doc').replace('.pdf', '')
    const url = URL.createObjectURL(new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `${name}_${result.tipo}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  function copyJson(result: any) {
    if (!result?.data) return
    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2))
    toast.success('JSON copiado!')
  }

  const currentResult = results[activeResultTab]

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Cabeçalho + abas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1>Leitor de PCMSO / ASO</h1>
          <p className="text-sm text-gray-500 mt-0.5">Extração inteligente via Groq · Llama 3.1 8B Instant</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMainTab('extracao')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${mainTab === 'extracao' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <FileText size={15} /> Extração
          </button>
          <button onClick={() => setMainTab('ficha')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${mainTab === 'ficha' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <ClipboardCheck size={15} /> Ficha de Cadastro
            {fichaPreenchida && <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">✓</span>}
          </button>
        </div>
      </div>

      {/* ═══ ABA EXTRAÇÃO ═══ */}
      {mainTab === 'extracao' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-400 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}`}
            >
              <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileChange} />
              {file ? (
                <><FileText size={28} className="mx-auto text-green-500 mb-2" /><p className="text-sm font-semibold text-green-700 truncate px-2">{file.name}</p><p className="text-xs text-green-600 mt-1">{(file.size/1024/1024).toFixed(1)} MB · Clique para trocar</p></>
              ) : (
                <><Upload size={28} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-500">Arraste o PDF aqui ou clique para selecionar</p><p className="text-xs text-gray-400 mt-1">PCMSO, ASO, GHE · até 50 MB</p></>
              )}
            </div>

            <div className="card p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Tipos de Extração</p>
              {TIPOS.map(t => {
                const checked = selectedTipos.includes(t.value)
                return (
                  <label key={t.value} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleTipo(t.value)} className="mt-0.5 accent-blue-600 flex-shrink-0 w-4 h-4" />
                    <div>
                      <p className={`text-sm font-medium leading-tight ${checked ? 'text-blue-800' : 'text-gray-700'}`}>{t.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{t.desc}</p>
                    </div>
                  </label>
                )
              })}
              {selectedTipos.includes('personalizado') && (
                <textarea value={instrucao} onChange={e => setInstrucao(e.target.value)} placeholder="Ex: Extraia apenas os exames e periodicidades por cargo..." className="input min-h-[80px] text-sm mt-1" />
              )}
            </div>

            <button onClick={handleExtract} disabled={loading || !file} className="btn-primary w-full disabled:opacity-50">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Extraindo...</> : <><Activity size={16} /> Extrair com IA ({selectedTipos.length} selecionado{selectedTipos.length !== 1 ? 's' : ''})</>}
            </button>

            {loading && <p className="text-center text-xs text-gray-400">Processando em sequência · ~15s por tipo</p>}

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 space-y-1">
              <p className="font-semibold">⚠️ Apenas PDFs com texto digital</p>
              <p>PDFs escaneados precisam de OCR antes do upload.</p>
            </div>
          </div>

          <div className="lg:col-span-2">
            {!results.length && !error && !loading && (
              <div className="card h-full min-h-[400px] flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <FileText size={48} className="mx-auto mb-3 text-gray-200" />
                  <p className="font-medium">Selecione um PDF e os tipos de extração</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="card h-full min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <Loader2 size={40} className="animate-spin text-blue-500 mx-auto mb-4" />
                  <p className="font-medium text-gray-600">Processando {selectedTipos.length} extração(ões)...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="card p-6 border-red-200">
                <div className="flex items-start gap-3">
                  <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-700">Erro na extração</p>
                    <p className="text-sm text-red-600 mt-1 leading-relaxed">{error}</p>
                    <button onClick={() => setError(null)} className="mt-3 text-xs text-red-400 underline">Fechar</button>
                  </div>
                </div>
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">{results.filter(r => !r.error).length}/{results.length} concluídas</span>
                    <span>{meta?.pages} páginas · {file?.name}</span>
                  </div>
                  {fichaPreenchida && (
                    <button onClick={() => setMainTab('ficha')} className="btn-primary btn-sm text-xs">
                      <ClipboardCheck size={13} /> Ver Ficha Preenchida
                    </button>
                  )}
                </div>

                {results.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {results.map((r, i) => (
                      <button key={i} onClick={() => { setActiveResultTab(i); setActiveViewTab('visual') }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${activeResultTab === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {r.error ? <XCircle size={11} className="text-red-400" /> : <CheckCircle size={11} className="text-green-400" />}
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}

                {currentResult && (
                  <>
                    {currentResult.error ? (
                      <div className="card p-5 border-red-100">
                        <div className="flex items-center gap-2 text-red-600"><AlertTriangle size={16} /><p className="font-medium text-sm">{currentResult.error}</p></div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex gap-1">
                            <button onClick={() => setActiveViewTab('visual')} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${activeViewTab === 'visual' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Visualização</button>
                            <button onClick={() => setActiveViewTab('json')} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${activeViewTab === 'json' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>JSON</button>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => downloadCsv(currentResult)} className="btn-secondary btn-sm text-xs"><Download size={12} /> CSV</button>
                            <button onClick={() => downloadJson(currentResult)} className="btn-secondary btn-sm text-xs"><Download size={12} /> JSON</button>
                            <button onClick={() => copyJson(currentResult)} className="btn-secondary btn-sm text-xs"><Copy size={12} /> Copiar</button>
                          </div>
                        </div>
                        {activeViewTab === 'visual' && <VisualResult data={currentResult.data} tipo={currentResult.tipo} />}
                        {activeViewTab === 'json' && (
                          <div className="card overflow-hidden">
                            <div className="px-4 py-2 bg-gray-800"><span className="text-xs text-gray-400 font-mono">{currentResult.tipo}.json</span></div>
                            <pre className="p-4 overflow-auto max-h-[600px] text-xs text-gray-300 bg-gray-900 leading-relaxed">{JSON.stringify(currentResult.data, null, 2)}</pre>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ ABA FICHA ═══ */}
      {mainTab === 'ficha' && (
        <div className="space-y-6">
          {/* Banner de sucesso */}
          {savedIds && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <CheckCircle size={22} className="text-green-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-green-800">Cadastro salvo com sucesso!</p>
                <p className="text-sm text-green-600 mt-0.5">Empresa e paciente registrados e vinculados no sistema.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {savedIds.companyId && <button onClick={() => navigate(`/companies/${savedIds!.companyId}`)} className="btn-secondary btn-sm text-xs"><ExternalLink size={12} /> Ver Empresa</button>}
                {savedIds.patientId && <button onClick={() => navigate(`/patients/${savedIds!.patientId}`)} className="btn-primary btn-sm text-xs"><ExternalLink size={12} /> Ver Paciente</button>}
              </div>
            </div>
          )}

          {!fichaPreenchida && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center gap-3 text-amber-700">
              <AlertTriangle size={18} className="flex-shrink-0" />
              <p className="text-sm">Ficha ainda não preenchida. Extraia um PDF primeiro para preenchimento automático.</p>
              <button onClick={() => setMainTab('extracao')} className="btn-secondary btn-sm text-xs ml-auto">Ir para Extração</button>
            </div>
          )}

          {/* ── Documento PCMSO ── */}
          <Section icon={BookOpen} title="Documento PCMSO" color="purple">
            <F label="Tipo de Documento"   value={fichaDocumento.tipo}           onChange={setDoc('tipo')} />
            <F label="Revisão"             value={fichaDocumento.revisao}         onChange={setDoc('revisao')} />
            <F label="Data de Elaboração"  value={fichaDocumento.dataElaboracao}  onChange={setDoc('dataElaboracao')} />
            <F label="Período Início"      value={fichaDocumento.periodoInicio}   onChange={setDoc('periodoInicio')} />
            <F label="Período Fim"         value={fichaDocumento.periodoFim}      onChange={setDoc('periodoFim')} />
          </Section>

          {/* ── Empresa ── */}
          <Section icon={Building2} title="Dados da Empresa" color="blue">
            <F label="Razão Social *"       value={fichaEmpresa.legalName}          onChange={setEmp('legalName')}          span2 />
            <F label="Nome Fantasia"        value={fichaEmpresa.tradeName}           onChange={setEmp('tradeName')} />
            <F label="CNPJ"                 value={fichaEmpresa.cnpj}               onChange={setEmp('cnpj')} />
            <F label="CPF Titular (pessoa física)" value={fichaEmpresa.cpfTitular}  onChange={setEmp('cpfTitular')} />
            <F label="Inscrição Estadual"   value={fichaEmpresa.inscricaoEstadual}   onChange={setEmp('inscricaoEstadual')} />
            <F label="Representante Legal"  value={fichaEmpresa.representanteLegal}  onChange={setEmp('representanteLegal')} />
            <F label="CNAE"                 value={fichaEmpresa.cnae}               onChange={setEmp('cnae')} />
            <F label="Descrição da Atividade (CNAE)" value={fichaEmpresa.descricaoCnae} onChange={setEmp('descricaoCnae')} />
            <div>
              <label className="label">Grau de Risco</label>
              <select value={fichaEmpresa.riskLevel} onChange={e => setEmp('riskLevel')(e.target.value)} className="input">
                <option value="1">Grau 1 — Baixo</option>
                <option value="2">Grau 2 — Médio</option>
                <option value="3">Grau 3 — Alto</option>
                <option value="4">Grau 4 — Crítico</option>
              </select>
            </div>
            <F label="Nº de Funcionários"   value={fichaEmpresa.employeeCount}      onChange={setEmp('employeeCount')} type="number" />
            <F label="Telefone"             value={fichaEmpresa.phone}              onChange={setEmp('phone')} />
            <F label="E-mail"               value={fichaEmpresa.email}              onChange={setEmp('email')} type="email" />
            <F label="Endereço"             value={fichaEmpresa.street}             onChange={setEmp('street')}  span2 />
            <F label="Bairro"               value={fichaEmpresa.bairro}             onChange={setEmp('bairro')} />
            <F label="Cidade"               value={fichaEmpresa.city}               onChange={setEmp('city')} />
            <F label="UF"                   value={fichaEmpresa.state}              onChange={setEmp('state')} />
            <F label="CEP"                  value={fichaEmpresa.zip}                onChange={setEmp('zip')} />
          </Section>

          {/* ── Consultoria ── */}
          <Section icon={Building2} title="Consultoria Elaboradora" color="orange">
            <F label="Razão Social"         value={fichaConsultoria.razaoSocial}     onChange={setCons('razaoSocial')} span2 />
            <F label="CNPJ"                 value={fichaConsultoria.cnpj}            onChange={setCons('cnpj')} />
            <F label="Responsável Legal"    value={fichaConsultoria.responsavelLegal}onChange={setCons('responsavelLegal')} />
            <F label="Endereço"             value={fichaConsultoria.endereco}        onChange={setCons('endereco')} span2 />
            <F label="Cidade"               value={fichaConsultoria.cidade}          onChange={setCons('cidade')} />
            <F label="Estado"               value={fichaConsultoria.estado}          onChange={setCons('estado')} />
            <F label="Telefone"             value={fichaConsultoria.telefone}        onChange={setCons('telefone')} />
            <F label="E-mail"               value={fichaConsultoria.email}           onChange={setCons('email')} type="email" />
          </Section>

          {/* ── Médico ── */}
          <Section icon={Stethoscope} title="Médico Responsável pelo PCMSO" color="green">
            <F label="Nome"                 value={fichaMedico.nome}   onChange={setMed('nome')} span2 />
            <F label="CRM"                  value={fichaMedico.crm}    onChange={setMed('crm')} />
            <F label="CPF"                  value={fichaMedico.cpf}    onChange={setMed('cpf')} />
            <F label="Cargo"                value={fichaMedico.cargo}  onChange={setMed('cargo')} span2 />
          </Section>

          {/* ── Paciente / Funcionário ── */}
          <Section icon={Users} title="Funcionário / Paciente (ASO)" color="green">
            <F label="Nome Completo *"      value={fichaPaciente.fullName}        onChange={setPac('fullName')}        span2 />
            <F label="CPF"                  value={fichaPaciente.cpf}             onChange={setPac('cpf')} />
            <F label="RG"                   value={fichaPaciente.rg}              onChange={setPac('rg')} />
            <F label="Data de Nascimento"   value={fichaPaciente.birthDate}       onChange={setPac('birthDate')}       type="date" />
            <div>
              <label className="label">Gênero</label>
              <select value={fichaPaciente.gender} onChange={e => setPac('gender')(e.target.value)} className="input">
                <option value="">Selecionar...</option>
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
                <option value="other">Outro</option>
                <option value="prefer_not">Prefiro não informar</option>
              </select>
            </div>
            <F label="Função / Cargo"       value={fichaPaciente.funcao}          onChange={setPac('funcao')} />
            <F label="CBO"                  value={fichaPaciente.cbo}             onChange={setPac('cbo')} />
            <F label="Setor"                value={fichaPaciente.setor}           onChange={setPac('setor')} />
            <F label="Matrícula"            value={fichaPaciente.matricula}       onChange={setPac('matricula')} />
            <F label="Data de Admissão"     value={fichaPaciente.dataAdmissao}    onChange={setPac('dataAdmissao')} />
            <F label="Telefone"             value={fichaPaciente.phone}           onChange={setPac('phone')} />
            <F label="E-mail"               value={fichaPaciente.email}           onChange={setPac('email')}           type="email" />
            <F label="Aptidão (ASO)"        value={fichaPaciente.aptidao}         onChange={setPac('aptidao')}         span2 />
            <F label="Restrições (ASO)"     value={fichaPaciente.restricoes}      onChange={setPac('restricoes')}      span2 />
            <F label="Validade do ASO"      value={fichaPaciente.validadeAso}     onChange={setPac('validadeAso')} />
            <F label="Data Próximo Exame"   value={fichaPaciente.dataProximoExame}onChange={setPac('dataProximoExame')} />
          </Section>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-medium text-sm text-gray-700">Salvar no sistema</p>
              <p className="text-xs text-gray-400 mt-0.5">Empresa e paciente serão criados e vinculados automaticamente. Consultoria e médico ficam salvos nos dados da empresa.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setFichaEmpresa(emptyEmpresa()); setFichaConsultoria(emptyConsult()); setFichaMedico(emptyMedico()); setFichaDocumento(emptyDocumento()); setFichaPaciente(emptyPaciente()); setSavedIds(null); setFichaPreenchida(false) }}
                className="btn-secondary"
              >
                Limpar Ficha
              </button>
              <button onClick={handleSaveFicha} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Save size={16} /> Salvar no Sistema</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

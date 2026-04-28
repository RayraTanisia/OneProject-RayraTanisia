import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, RefreshCw, Info, AlertTriangle, Camera, FileText, CheckCircle, XCircle } from 'lucide-react'
import { api } from '../../lib/api'

interface Message {
  id: string
  from: 'bot' | 'user'
  text: string
  time: string
  options?: Opt[]
  priority?: boolean
  imagePreview?: string
}
interface Opt { label: string; value: string }

type Step =
  | 'welcome' | 'profile'
  | 'dt_nome' | 'dt_cpf' | 'dt_exam' | 'dt_cat' | 'dt_result'
  | 'em_cnpj' | 'em_razao' | 'em_resp' | 'em_email' | 'em_fone' | 'em_result'
  | 'fn_nome' | 'fn_cpf' | 'fn_empresa' | 'fn_exam' | 'fn_result'
  | 'co_nome' | 'co_cpf' | 'co_edital' | 'co_result'
  | 'vi_nome' | 'vi_cpf' | 'vi_estab' | 'vi_tipo' | 'vi_result'
  | 'ad_nome' | 'ad_cpf' | 'ad_tipo' | 'ad_result'
  | 'fq_nome' | 'fq_menu'
  | 'hm_nome' | 'hm_cpf'
  | 'ocr_confirm'
  | 'human_transfer' | 'done'

// ─── Menus ────────────────────────────────────────────────────────────────────
const PROFILE_MENU: Opt[] = [
  { label: '👤 Sou funcionário / paciente', value: 'funcionario' },
  { label: '🏢 Represento uma empresa', value: 'empresa' },
  { label: '🚗 Atendimento Detran', value: 'detran' },
  { label: '📋 Sou concursado', value: 'concursado' },
  { label: '🍽️ Vigilância Sanitária / Alimentos', value: 'vigilancia' },
  { label: '📄 Solicitação administrativa', value: 'administrativo' },
  { label: '❓ Dúvidas gerais', value: 'faq' },
  { label: '📞 Falar com atendente', value: 'human' },
]

const DETRAN_EXAMS: Opt[] = [
  { label: '🩺 Exame Médico', value: 'medico' },
  { label: '🧠 Exame Psicológico', value: 'psicologico' },
  { label: '🧪 Toxicológico', value: 'toxicologico' },
  { label: '📦 Pacote Completo (Médico + Psicológico)', value: 'completo' },
]
const DETRAN_CATS: Opt[] = [
  { label: '🅰️ Categoria A (Moto)', value: 'A' },
  { label: '🅱️ Categoria B (Carro)', value: 'B' },
  { label: '🚌 Categoria C/D/E (Profissional)', value: 'CDE' },
  { label: '🔄 Renovação', value: 'renovacao' },
  { label: '➕ Adição de categoria', value: 'adicao' },
]
const FUNC_EXAMS: Opt[] = [
  { label: '📥 Admissional', value: 'admissional' },
  { label: '🔄 Periódico', value: 'periodico' },
  { label: '📤 Demissional', value: 'demissional' },
  { label: '↩️ Retorno ao trabalho', value: 'retorno' },
  { label: '🔀 Mudança de função', value: 'mudanca' },
]
const VIG_TIPOS: Opt[] = [
  { label: '🆕 Primeiro exame (novo funcionário)', value: 'novo' },
  { label: '🔄 Renovação anual', value: 'renovacao' },
  { label: '📋 ASO para manipulador', value: 'aso' },
]
const ADMIN_TIPOS: Opt[] = [
  { label: '📋 Solicitar / Corrigir ASO', value: 'aso' },
  { label: '📝 Declaração de comparecimento', value: 'declaracao' },
  { label: '✅ Confirmar comparecimento', value: 'confirmacao' },
  { label: '📎 Outra solicitação documental', value: 'outro' },
]
const FAQ_ITEMS: Opt[] = [
  { label: '🕐 Horário de funcionamento', value: 'hours' },
  { label: '📋 Documentos necessários', value: 'docs' },
  { label: '💰 Valores e formas de pagamento', value: 'payment' },
  { label: '🔬 Exames realizados', value: 'exams' },
  { label: '⏱️ Tempo médio de atendimento', value: 'time' },
  { label: '📍 Endereço e contato', value: 'address' },
  { label: '📅 Como funciona o atendimento', value: 'flow' },
  { label: '📞 Falar com atendente', value: 'human' },
  { label: '↩️ Voltar ao início', value: 'back' },
]
const FAQ_ANSWERS: Record<string, string> = {
  hours: '🕐 *Horário de funcionamento:*\n\nSegunda a Sexta: 07h00 às 18h00\nSábados: 07h00 às 12h00\nDomingos e Feriados: Fechado\n\n⚠️ O atendimento é por ordem de chegada.',
  docs: '📋 *Documentos necessários (geral):*\n\n✅ Documento com foto (RG ou CNH)\n✅ CPF\n✅ Cartão do convênio (se houver)\n✅ Solicitação da empresa (para exames ocupacionais)\n✅ Lista de medicamentos em uso contínuo',
  payment: '💳 *Valores e pagamento:*\n\nOs valores variam conforme o tipo de exame.\n\n*Formas aceitas:*\n✅ PIX\n✅ Cartão de crédito/débito\n✅ Dinheiro\n✅ Convênio empresarial\n\nPara tabela de preços, entre em contato com a recepção.',
  exams: '🔬 *Exames realizados:*\n\n🏥 *Medicina Ocupacional:*\n• Admissional, Periódico, Demissional, Retorno, Mudança de função\n• ASO\n\n🚗 *Detran:* Médico, Psicológico, Toxicológico\n\n🍽️ *Vigilância Sanitária:* ASO para manipulador\n\n📋 *Concursos:* Conforme edital',
  time: '⏱️ *Tempo médio:*\n\n• Triagem: ~10 min\n• Exame médico: ~20–40 min\n• Detran completo: ~60–90 min\n• Psicológico: ~60 min',
  address: '📍 *Localização:*\n\nRua da Saúde, 123 — Centro\nCuiabá, MT — CEP 78000-000\n\n📞 (65) 3000-0000\n📱 (65) 99000-0000\n📧 contato@clinica.com.br',
  flow: '📅 *Como funciona:*\n\n1️⃣ Chegue na clínica\n2️⃣ Informe seu nome na recepção\n3️⃣ Apresente os documentos\n4️⃣ Aguarde ser chamado\n5️⃣ Realize o exame\n6️⃣ Receba o resultado/ASO',
}

const AFTER_OPTS: Opt[] = [
  { label: '💰 Ver valores', value: 'ver_valores' },
  { label: '📞 Falar com atendente', value: 'human' },
  { label: '🔙 Nova consulta', value: 'restart' },
]
const AFTER_NO_PRICE: Opt[] = [
  { label: '📞 Falar com atendente', value: 'human' },
  { label: '🔙 Nova consulta', value: 'restart' },
]

function now() { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
function mkBot(text: string, options?: Opt[], priority?: boolean): Message {
  return { id: Math.random().toString(36).slice(2), from: 'bot', text, time: now(), options, priority }
}
function mkUser(text: string, imagePreview?: string): Message {
  return { id: Math.random().toString(36).slice(2), from: 'user', text, time: now(), imagePreview }
}

const WELCOME_MSG = mkBot(
  '👋 Olá! Seja bem-vindo(a) à *Clínica de Medicina do Trabalho*!\n\nSou o assistente virtual. 😊\n\n*Qual o seu perfil?*',
  PROFILE_MENU
)

const DATA_LABELS: Record<string, string> = {
  nome: 'Nome', cpf: 'CPF', cnpj: 'CNPJ', razaoSocial: 'Razão Social',
  responsavel: 'Responsável', email: 'E-mail', telefone: 'Telefone',
  empresa: 'Empresa', edital: 'Edital/Concurso',
  detranExamLabel: 'Exame Detran', detranCatLabel: 'Categoria CNH',
  funcExamLabel: 'Tipo de Exame', estabelecimento: 'Estabelecimento',
  vigTipoLabel: 'Tipo Vigilância', adTipoLabel: 'Solicitação',
}

type SaveResult = { ok: true } | { ok: false; duplicate?: boolean }

// ─── Componente ───────────────────────────────────────────────────────────────
export default function ReceptionChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG])
  const [step, setStep] = useState<Step>('profile')
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [data, setData] = useState<Record<string, string>>({})
  const [stepBeforeOcr, setStepBeforeOcr] = useState<Step>('profile')
  const [ocrData, setOcrData] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  function addUser(text: string, imagePreview?: string) {
    setMessages(p => [...p, mkUser(text, imagePreview)])
  }

  function addBot(text: string, options?: Opt[], delay = 900, priority?: boolean) {
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages(p => [...p, mkBot(text, options, priority)])
    }, delay)
  }

  async function showResult(msg: string, opts: Opt[], priority?: boolean, saveFn?: () => Promise<SaveResult>) {
    setTyping(true)
    let suffix = ''
    if (saveFn) {
      const r = await saveFn().catch(() => ({ ok: false as const }))
      if (r.ok) suffix = '\n\n💾 *Dados salvos no sistema com sucesso!*'
      else if (!r.ok && (r as any).duplicate) suffix = '\n\n📋 *Cadastro já existente no sistema — identificado com sucesso!*'
      else suffix = '\n\n⚠️ *Não foi possível salvar automaticamente. Por favor, apresente seus dados na recepção para cadastro.*'
    }
    await new Promise(res => setTimeout(res, 700))
    setTyping(false)
    setMessages(p => [...p, mkBot(msg + suffix, opts, priority)])
  }

  async function savePatient(fields: { fullName: string; cpf: string; customFields?: Record<string, string> }): Promise<SaveResult> {
    const cpfClean = fields.cpf.replace(/\D/g, '')
    if (cpfClean.length !== 11) return { ok: false }
    try {
      await api.post('/public/chatbot/patient', {
        fullName: fields.fullName,
        cpf: cpfClean,
        customFields: { origem: 'chatbot', ...fields.customFields },
        lgpdConsent: { consented: true, channels: ['whatsapp'] },
      })
      return { ok: true }
    } catch (err: any) {
      if (err?.response?.status === 409) return { ok: false, duplicate: true }
      return { ok: false }
    }
  }

  async function saveCompany(fields: { cnpj: string; legalName: string; tradeName?: string; phone?: string; email?: string }): Promise<SaveResult> {
    const cnpjClean = fields.cnpj.replace(/\D/g, '')
    if (cnpjClean.length !== 14) return { ok: false }
    try {
      await api.post('/public/chatbot/company', {
        cnpj: cnpjClean,
        legalName: fields.legalName,
        tradeName: fields.tradeName,
        phone: fields.phone,
        email: fields.email,
      })
      return { ok: true }
    } catch (err: any) {
      if (err?.response?.status === 409) return { ok: false, duplicate: true }
      return { ok: false }
    }
  }

  function restart() {
    setMessages([WELCOME_MSG])
    setStep('profile')
    setInput('')
    setData({})
    setOcrData({})
  }

  function transferHuman(extra?: Record<string, string>) {
    const merged = { ...data, ...extra }
    const ctx = Object.entries(DATA_LABELS).filter(([k]) => merged[k]).map(([k, lbl]) => `• ${lbl}: ${merged[k]}`).join('\n')
    setStep('human_transfer')
    addBot(
      `👤 *Transferindo para atendente humano...*\n\n📋 *Dados registrados:*\n${ctx || '(sem identificação)'}\n\nUm atendente irá retornar em breve!\n⏱️ Tempo estimado: *~2 a 5 minutos*\n\n📞 (65) 3000-0000`,
      [{ label: '🔙 Voltar ao início', value: 'restart' }]
    )
  }

  // ─── OCR — leitura de documento ──────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const isImage = file.type.startsWith('image/')
    if (!isImage) {
      addBot('⚠️ Por enquanto só aceitamos imagens (JPG, PNG, WEBP). Tire uma foto do documento e envie.', undefined, 300)
      return
    }

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      const base64 = dataUrl.split(',')[1]
      const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

      addUser(`📎 ${file.name}`, dataUrl)
      setTyping(true)

      try {
        const res = await api.post('/documents/analyze', { image: base64, mimeType })
        const ocr = res.data?.data || {}

        // Montar lista do que foi encontrado
        const found: string[] = []
        if (ocr.nome) found.push(`👤 Nome: *${ocr.nome}*`)
        if (ocr.cpf) found.push(`🪪 CPF: *${ocr.cpf}*`)
        if (ocr.rg) found.push(`🪪 RG: *${ocr.rg}*`)
        if (ocr.dataNascimento) found.push(`🎂 Nascimento: *${ocr.dataNascimento}*`)
        if (ocr.empresa) found.push(`🏢 Empresa: *${ocr.empresa}*`)
        if (ocr.cargo) found.push(`💼 Cargo: *${ocr.cargo}*`)
        if (ocr.cnpj) found.push(`🏭 CNPJ: *${ocr.cnpj}*`)
        if (ocr.razaoSocial) found.push(`🏢 Razão Social: *${ocr.razaoSocial}*`)
        if (ocr.responsavel) found.push(`👤 Responsável: *${ocr.responsavel}*`)
        if (ocr.email) found.push(`📧 Email: *${ocr.email}*`)
        if (ocr.telefone) found.push(`📱 Telefone: *${ocr.telefone}*`)
        if (ocr.categoriaCNH) found.push(`🚗 Categoria CNH: *${ocr.categoriaCNH}*`)
        if (ocr.edital) found.push(`📋 Edital: *${ocr.edital}*`)

        if (found.length === 0) {
          setTyping(false)
          addBot('⚠️ Não consegui extrair dados deste documento. Tente uma foto com melhor iluminação ou preencha manualmente.', undefined, 300)
          return
        }

        const ocrMapped: Record<string, string> = {}
        if (ocr.nome) ocrMapped.nome = ocr.nome
        if (ocr.cpf) ocrMapped.cpf = ocr.cpf.replace(/\D/g, '')
        if (ocr.empresa) ocrMapped.empresa = ocr.empresa
        if (ocr.cargo) ocrMapped.cargo = ocr.cargo
        if (ocr.cnpj) ocrMapped.cnpj = ocr.cnpj.replace(/\D/g, '')
        if (ocr.razaoSocial) ocrMapped.razaoSocial = ocr.razaoSocial
        if (ocr.responsavel) ocrMapped.responsavel = ocr.responsavel
        if (ocr.email) ocrMapped.email = ocr.email
        if (ocr.telefone) ocrMapped.telefone = ocr.telefone.replace(/\D/g, '')

        setOcrData(ocrMapped)
        setStepBeforeOcr(step)
        setStep('ocr_confirm')

        setTyping(false)
        setMessages(p => [...p, mkBot(
          `📄 *Documento analisado!* (${ocr.tipoDocumento || 'Documento'})\n\n` +
          `Encontrei os seguintes dados:\n${found.join('\n')}\n\n` +
          `*Deseja usar estes dados para preencher o cadastro?*`,
          [
            { label: '✅ Sim, usar estes dados', value: 'ocr_apply' },
            { label: '✏️ Não, prefiro digitar manualmente', value: 'ocr_skip' },
          ]
        )])
      } catch {
        setTyping(false)
        addBot('⚠️ Não foi possível analisar o documento agora. Por favor, preencha os dados manualmente.', undefined, 300)
      }
    }
    reader.readAsDataURL(file)
  }

  // Aplica os dados do OCR no state e avança para o próximo passo sem dado
  function applyOcr() {
    const merged = { ...data, ...ocrData }
    setData(merged)

    // Determinar qual o próximo step que ainda precisa de input, baseado no stepBeforeOcr
    const isDetran = ['dt_nome','dt_cpf','dt_exam','dt_cat'].includes(stepBeforeOcr)
    const isEmpresa = ['em_cnpj','em_razao','em_resp','em_email','em_fone'].includes(stepBeforeOcr)
    const isFuncionario = ['fn_nome','fn_cpf','fn_empresa','fn_exam'].includes(stepBeforeOcr)
    const isConcursado = ['co_nome','co_cpf','co_edital'].includes(stepBeforeOcr)
    const isVigilancia = ['vi_nome','vi_cpf','vi_estab','vi_tipo'].includes(stepBeforeOcr)
    const isAdmin = ['ad_nome','ad_cpf'].includes(stepBeforeOcr)

    let nextStep: Step = stepBeforeOcr

    if (isDetran) {
      if (!merged.nome) nextStep = 'dt_nome'
      else if (!merged.cpf) nextStep = 'dt_cpf'
      else nextStep = 'dt_exam'
    } else if (isEmpresa) {
      if (!merged.cnpj) nextStep = 'em_cnpj'
      else if (!merged.razaoSocial) nextStep = 'em_razao'
      else if (!merged.responsavel) nextStep = 'em_resp'
      else if (!merged.email) nextStep = 'em_email'
      else nextStep = 'em_fone'
    } else if (isFuncionario) {
      if (!merged.nome) nextStep = 'fn_nome'
      else if (!merged.cpf) nextStep = 'fn_cpf'
      else if (!merged.empresa) nextStep = 'fn_empresa'
      else nextStep = 'fn_exam'
    } else if (isConcursado) {
      if (!merged.nome) nextStep = 'co_nome'
      else if (!merged.cpf) nextStep = 'co_cpf'
      else nextStep = 'co_edital'
    } else if (isVigilancia) {
      if (!merged.nome) nextStep = 'vi_nome'
      else if (!merged.cpf) nextStep = 'vi_cpf'
      else if (!merged.estabelecimento) nextStep = 'vi_estab'
      else nextStep = 'vi_tipo'
    } else if (isAdmin) {
      if (!merged.nome) nextStep = 'ad_nome'
      else if (!merged.cpf) nextStep = 'ad_cpf'
      else nextStep = 'ad_tipo'
    }

    setStep(nextStep)
    setOcrData({})

    const stepLabels: Partial<Record<Step, string>> = {
      dt_exam: 'Qual *tipo de exame* Detran você precisa?',
      dt_cpf: 'Preciso do seu *CPF* (apenas números):',
      dt_nome: 'Qual é o seu *nome completo*?',
      fn_exam: 'Qual *tipo de exame* você precisa realizar?',
      fn_empresa: 'Qual é o nome da *empresa* onde trabalha?',
      fn_cpf: 'Preciso do seu *CPF* (apenas números):',
      fn_nome: 'Qual é o seu *nome completo*?',
      em_fone: 'Qual é o *telefone / WhatsApp* da empresa?',
      em_email: 'Qual é o *e-mail* para contato?',
      em_resp: 'Qual é o nome do *responsável* pelo contato?',
      em_razao: 'Qual é a *razão social* da empresa?',
      em_cnpj: 'Preciso do *CNPJ* da empresa:',
      co_edital: 'Qual o nome do *concurso ou edital*?',
      co_cpf: 'Preciso do seu *CPF* (apenas números):',
      co_nome: 'Qual é o seu *nome completo*?',
      vi_tipo: 'Qual é o *tipo de atendimento* que precisa?',
      vi_estab: 'Qual o nome do *estabelecimento* onde trabalha?',
      vi_cpf: 'Preciso do seu *CPF* (apenas números):',
      vi_nome: 'Qual é o seu *nome completo*?',
      ad_tipo: 'O que você precisa?',
      ad_cpf: 'Preciso do seu *CPF* (apenas números):',
      ad_nome: 'Qual é o seu *nome completo*?',
    }

    const nextPrompt = stepLabels[nextStep]
    const opts = nextStep === 'dt_exam' ? DETRAN_EXAMS
      : nextStep === 'fn_exam' ? FUNC_EXAMS
      : nextStep === 'vi_tipo' ? VIG_TIPOS
      : nextStep === 'ad_tipo' ? ADMIN_TIPOS
      : undefined

    const confirmMsg = `✅ *Dados aplicados do documento!*\n\n${
      merged.nome ? `👤 ${merged.nome}\n` : ''
    }${merged.cpf ? `🪪 ${merged.cpf}\n` : ''}${merged.empresa || merged.razaoSocial ? `🏢 ${merged.empresa || merged.razaoSocial}\n` : ''
    }\n${nextPrompt || 'Próximo passo:'}`

    addBot(confirmMsg, opts, 600)
  }

  // ─── handleOption ─────────────────────────────────────────────────────────
  async function handleOption(label: string, value: string) {
    addUser(label)

    if (value === 'restart' || value === 'back') { setTimeout(restart, 600); return }
    if (value === 'human') {
      if (!data.nome) { setStep('hm_nome'); addBot('Para conectar com um atendente, qual é o seu *nome completo*?'); return }
      transferHuman(); return
    }
    if (value === 'ver_valores') {
      addBot('💰 *Valores dos serviços:*\n\nVariam conforme o tipo de exame.\n\n📞 (65) 3000-0000\n📱 (65) 99000-0000\n📧 contato@clinica.com.br', undefined, 700); return
    }

    // OCR confirm/skip
    if (step === 'ocr_confirm') {
      if (value === 'ocr_apply') { applyOcr(); return }
      if (value === 'ocr_skip') {
        setStep(stepBeforeOcr)
        setOcrData({})
        const hint: Partial<Record<Step, string>> = {
          dt_nome: 'Qual é o seu *nome completo*?',
          fn_nome: 'Qual é o seu *nome completo*?',
          em_cnpj: 'Informe o *CNPJ* da empresa:',
          co_nome: 'Qual é o seu *nome completo*?',
          vi_nome: 'Qual é o seu *nome completo*?',
          ad_nome: 'Qual é o seu *nome completo*?',
        }
        addBot(hint[stepBeforeOcr] || 'Continue digitando os dados:', undefined, 400)
        return
      }
    }

    // Perfil
    if (step === 'profile') {
      const map: Record<string, [Step, string, boolean?]> = {
        detran:        ['dt_nome', '🚗 *Atendimento DETRAN — Prioridade!* 🏃\n\nVamos registrar seus dados.\n\nQual é o seu *nome completo*?\n\n💡 *Dica:* você também pode enviar uma foto do seu RG ou CNH que preencheremos automaticamente!', true],
        empresa:       ['em_cnpj', '🏢 *Atendimento Empresarial*\n\nVamos cadastrar sua empresa.\n\nInforme o *CNPJ* da empresa (apenas números):\n\n💡 *Dica:* envie uma foto do cartão CNPJ ou formulário que preencheremos automaticamente!'],
        funcionario:   ['fn_nome', '👤 *Atendimento ao Funcionário/Paciente*\n\nVamos registrar seus dados.\n\nQual é o seu *nome completo*?\n\n💡 *Dica:* envie uma foto do seu RG ou ficha de funcionário!'],
        concursado:    ['co_nome', '📋 *Atendimento a Concursados*\n\nQual é o seu *nome completo*?'],
        vigilancia:    ['vi_nome', '🍽️ *Vigilância Sanitária*\n\nQual é o seu *nome completo*?'],
        administrativo:['ad_nome', '📄 *Solicitações Administrativas*\n\nQual é o seu *nome completo*?'],
        faq:           ['fq_nome', '❓ *Dúvidas Frequentes*\n\nQual é o seu *nome*?'],
      }
      const cfg = map[value]
      if (cfg) { setStep(cfg[0]); addBot(cfg[1], undefined, 700, cfg[2]); }
      return
    }

    // Detran: exam
    if (step === 'dt_exam') {
      setData(p => ({ ...p, detranExam: value, detranExamLabel: label }))
      setStep('dt_cat')
      addBot('Qual é a *categoria* da sua CNH ou operação?', DETRAN_CATS)
      return
    }
    // Detran: categoria → salva e resultado
    if (step === 'dt_cat') {
      const nome = data.nome || ''; const cpf = data.cpf || ''; const examLabel = data.detranExamLabel || ''
      const needRenach = value === 'renovacao' || value === 'adicao'
      setData(p => ({ ...p, detranCat: value, detranCatLabel: label }))
      setStep('dt_result')
      await showResult(
        `⚡ *CADASTRO DETRAN REGISTRADO COM PRIORIDADE!*\n\n✅ Dados:\n👤 Nome: ${nome}\n🪪 CPF: ${cpf}\n🔬 Exame: ${examLabel}\n🚗 Categoria: ${label}\n\n` +
        `📄 *Documentos necessários:*\n✅ Documento com foto (RG ou CNH)\n✅ CPF\n` +
        (needRenach ? `✅ *CNH atual*\n✅ *RENACH* (emitido pelo Detran)\n` : `✅ *RENACH* (emitido pelo Detran)\n`) +
        `\n🏃 *Você tem PRIORIDADE!* Informe na recepção: *"Atendimento DETRAN"*\n⏰ Segunda a Sexta, 07h00 às 17h00`,
        AFTER_OPTS, true,
        () => savePatient({ fullName: nome, cpf, customFields: { setor: 'detran', exame: examLabel, categoria: label } })
      )
      return
    }
    // Funcionário: exam → salva e resultado
    if (step === 'fn_exam') {
      const nome = data.nome || ''; const cpf = data.cpf || ''; const empresa = data.empresa || ''
      setData(p => ({ ...p, funcExam: value, funcExamLabel: label }))
      setStep('fn_result')
      await showResult(
        `✅ *IDENTIFICAÇÃO REGISTRADA!*\n\n👤 Nome: ${nome}\n🪪 CPF: ${cpf}\n🏢 Empresa: ${empresa}\n🔬 Exame: ${label}\n\n` +
        `📋 *Documentos necessários:*\n✅ Documento com foto\n✅ CPF\n✅ *Autorização da empresa* (OBRIGATÓRIO)\n✅ Exames anteriores\n✅ Lista de medicamentos\n\n` +
        `⏰ Segunda a Sexta, 07h00 às 17h00 — por ordem de chegada`,
        AFTER_OPTS, undefined,
        () => savePatient({ fullName: nome, cpf, customFields: { setor: 'medicina_trabalho', empresa, tipoExame: label } })
      )
      return
    }
    // Vigilância: tipo → salva e resultado
    if (step === 'vi_tipo') {
      const nome = data.nome || ''; const cpf = data.cpf || ''; const estab = data.estabelecimento || ''
      setData(p => ({ ...p, vigTipo: value, vigTipoLabel: label }))
      setStep('vi_result')
      await showResult(
        `✅ *IDENTIFICAÇÃO REGISTRADA!*\n\n👤 ${nome}\n🪪 CPF: ${cpf}\n🏪 Estabelecimento: ${estab}\n🍽️ Tipo: ${label}\n\n` +
        `🔬 *Exames para Manipulador de Alimentos:*\n• Exame médico clínico • Hemograma • Coprocultura • Hepatite A • VDRL • Urina tipo I\n\n` +
        `📋 *Documentos:*\n✅ RG/CNH ✅ CPF ✅ Solicitação da empresa\n\n⏱️ ASO emitido em 3 a 5 dias úteis`,
        AFTER_OPTS, undefined,
        () => savePatient({ fullName: nome, cpf, customFields: { setor: 'vigilancia_sanitaria', estabelecimento: estab, tipo: label } })
      )
      return
    }
    // Administrativo: tipo → salva e resultado
    if (step === 'ad_tipo') {
      const nome = data.nome || ''; const cpf = data.cpf || ''
      setData(p => ({ ...p, adTipo: value, adTipoLabel: label }))
      setStep('ad_result')
      const msgs: Record<string, string> = {
        aso: `✅ *Solicitação de ASO Registrada!*\n\n👤 ${nome}\n🪪 CPF: ${cpf}\n\n📬 Retorno em até *24 horas úteis*.`,
        declaracao: `✅ *Declaração de Comparecimento Solicitada!*\n\n👤 ${nome}\n🪪 CPF: ${cpf}\n\n📬 Emitida em até *24 horas úteis*.`,
        confirmacao: `✅ *Confirmação de Comparecimento*\n\n👤 ${nome}\n🪪 CPF: ${cpf}\n\nInforme nome, data e CPF à recepção.`,
        outro: `✅ *Solicitação Registrada!*\n\n👤 ${nome}\n🪪 CPF: ${cpf}\n\n📬 Encaminharemos ao setor responsável em até *1 dia útil*.`,
      }
      await showResult(msgs[value] || msgs.outro, AFTER_NO_PRICE, undefined,
        () => savePatient({ fullName: nome, cpf, customFields: { setor: 'administrativo', solicitacao: label } })
      )
      return
    }
    // FAQ
    if (step === 'fq_menu') {
      const answer = FAQ_ANSWERS[value]
      if (answer) addBot(answer, FAQ_ITEMS)
      return
    }
  }

  // ─── handleSend ───────────────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim()
    if (!text) return
    addUser(text)
    setInput('')

    // Detran
    if (step === 'dt_nome') { setData(p => ({ ...p, nome: text })); setStep('dt_cpf'); addBot(`Olá, *${text}*! 😊\n\nInforme seu *CPF* (apenas números):`); return }
    if (step === 'dt_cpf') { setData(p => ({ ...p, cpf: text })); setStep('dt_exam'); addBot('Qual *tipo de exame* você precisa?', DETRAN_EXAMS); return }
    // Empresa
    if (step === 'em_cnpj') { setData(p => ({ ...p, cnpj: text })); setStep('em_razao'); addBot('CNPJ registrado! Qual é a *razão social*?'); return }
    if (step === 'em_razao') { setData(p => ({ ...p, razaoSocial: text })); setStep('em_resp'); addBot('Qual é o seu *nome completo* (responsável)?'); return }
    if (step === 'em_resp') { setData(p => ({ ...p, responsavel: text })); setStep('em_email'); addBot('📧 Qual é o *e-mail* para contato?'); return }
    if (step === 'em_email') { setData(p => ({ ...p, email: text })); setStep('em_fone'); addBot('📱 Qual é o *telefone / WhatsApp*?'); return }
    if (step === 'em_fone') {
      const { cnpj = '', razaoSocial = '', responsavel = '', email = '' } = data
      setData(p => ({ ...p, telefone: text })); setStep('em_result')
      await showResult(
        `🏢 *CADASTRO EMPRESARIAL REGISTRADO!*\n\n🏭 CNPJ: ${cnpj}\n🏢 Empresa: ${razaoSocial}\n👤 Responsável: ${responsavel}\n📧 ${email}\n📱 ${text}\n\n📬 Consultor entrará em contato em até *1 dia útil*.`,
        AFTER_NO_PRICE, undefined,
        () => saveCompany({ cnpj, legalName: razaoSocial, tradeName: responsavel, phone: text, email })
      )
      return
    }
    // Funcionário
    if (step === 'fn_nome') { setData(p => ({ ...p, nome: text })); setStep('fn_cpf'); addBot(`Olá, *${text}*! 😊\n\nInforme seu *CPF* (apenas números):`); return }
    if (step === 'fn_cpf') { setData(p => ({ ...p, cpf: text })); setStep('fn_empresa'); addBot('Qual é o nome da *empresa* onde você trabalha?'); return }
    if (step === 'fn_empresa') { setData(p => ({ ...p, empresa: text })); setStep('fn_exam'); addBot('Qual *tipo de exame* você precisa?', FUNC_EXAMS); return }
    // Concursado
    if (step === 'co_nome') { setData(p => ({ ...p, nome: text })); setStep('co_cpf'); addBot(`Olá, *${text}*! 😊\n\nInforme seu *CPF* (apenas números):`); return }
    if (step === 'co_cpf') { setData(p => ({ ...p, cpf: text })); setStep('co_edital'); addBot('Qual é o nome do *concurso ou edital*?'); return }
    if (step === 'co_edital') {
      const { nome = '', cpf = '' } = data; setData(p => ({ ...p, edital: text })); setStep('co_result')
      await showResult(
        `✅ *IDENTIFICAÇÃO REGISTRADA!*\n\n👤 ${nome}\n🪪 CPF: ${cpf}\n📋 Edital: ${text}\n\n` +
        `🔬 *Exames geralmente exigidos:*\n• Hemograma • Glicemia • Urina tipo I • Acuidade visual • Audiometria • ECG • Exame clínico • Psicológico (quando exigido)\n\n` +
        `⚠️ *Traga a lista exata de exames do edital!*\n⏰ Seg–Sex 07h–17h | Sáb 07h–11h`,
        AFTER_OPTS, undefined,
        () => savePatient({ fullName: nome, cpf, customFields: { setor: 'concursado', edital: text } })
      )
      return
    }
    // Vigilância
    if (step === 'vi_nome') { setData(p => ({ ...p, nome: text })); setStep('vi_cpf'); addBot(`Olá, *${text}*! 😊\n\nInforme seu *CPF* (apenas números):`); return }
    if (step === 'vi_cpf') { setData(p => ({ ...p, cpf: text })); setStep('vi_estab'); addBot('Qual é o nome do *estabelecimento* onde trabalha?'); return }
    if (step === 'vi_estab') { setData(p => ({ ...p, estabelecimento: text })); setStep('vi_tipo'); addBot('Qual é o *tipo de atendimento*?', VIG_TIPOS); return }
    // Administrativo
    if (step === 'ad_nome') { setData(p => ({ ...p, nome: text })); setStep('ad_cpf'); addBot(`Olá, *${text}*! 😊\n\nInforme seu *CPF* (apenas números):`); return }
    if (step === 'ad_cpf') { setData(p => ({ ...p, cpf: text })); setStep('ad_tipo'); addBot('O que você precisa?', ADMIN_TIPOS); return }
    // FAQ
    if (step === 'fq_nome') { setData(p => ({ ...p, nome: text })); setStep('fq_menu'); addBot(`Olá, *${text}*! 😊\n\nSobre o que quer saber?`, FAQ_ITEMS); return }
    // Humano direto
    if (step === 'hm_nome') { setData(p => ({ ...p, nome: text })); setStep('hm_cpf'); addBot(`Olá, *${text}*! 😊\n\nInforme seu *CPF* (apenas números):`); return }
    if (step === 'hm_cpf') { transferHuman({ nome: data.nome || '', cpf: text }); return }

    addBot('Como posso te ajudar?', PROFILE_MENU)
    setStep('profile')
  }

  const TEXT_STEPS: Step[] = [
    'dt_nome','dt_cpf','em_cnpj','em_razao','em_resp','em_email','em_fone',
    'fn_nome','fn_cpf','fn_empresa','co_nome','co_cpf','co_edital',
    'vi_nome','vi_cpf','vi_estab','ad_nome','ad_cpf','fq_nome','hm_nome','hm_cpf',
  ]
  const PLACEHOLDERS: Partial<Record<Step, string>> = {
    dt_nome:'Nome completo...', dt_cpf:'CPF (apenas números)...',
    em_cnpj:'CNPJ (apenas números)...', em_razao:'Razão social...', em_resp:'Seu nome...', em_email:'E-mail...', em_fone:'Telefone / WhatsApp...',
    fn_nome:'Nome completo...', fn_cpf:'CPF...', fn_empresa:'Nome da empresa...',
    co_nome:'Nome completo...', co_cpf:'CPF...', co_edital:'Ex: Prefeitura Cuiabá 2024...',
    vi_nome:'Nome completo...', vi_cpf:'CPF...', vi_estab:'Nome do estabelecimento...',
    ad_nome:'Nome completo...', ad_cpf:'CPF...',
    fq_nome:'Seu nome...', hm_nome:'Nome completo...', hm_cpf:'CPF...',
  }

  const isInput = TEXT_STEPS.includes(step)
  const canUploadDoc = isInput || step === 'ocr_confirm'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1>Assistente Virtual — Central de Atendimento</h1>
          <p className="text-sm text-gray-500">Simulação do robô de recepção via WhatsApp</p>
        </div>
        <button onClick={restart} className="btn-secondary btn-sm">
          <RefreshCw size={14} /> Reiniciar
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 text-sm text-blue-700">
        <Info size={16} className="flex-shrink-0 mt-0.5" />
        <span>Cada perfil coleta o <strong>cadastro completo</strong> e salva no sistema. Envie uma <strong>foto do documento</strong> para preenchimento automático via IA. Em produção via WhatsApp Business API.</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {['🚗 Detran', '🏢 Empresas', '👤 Funcionários', '📋 Concursados', '🍽️ Vigilância', '📄 Administrativo', '❓ FAQ'].map(s => (
          <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{s}</span>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200" style={{ background: '#e5ddd5' }}>
        {/* Header WhatsApp */}
        <div className="bg-[#075e54] px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Assistente — Clínica MT</p>
            <p className="text-green-300 text-xs">● Online — Resposta imediata</p>
          </div>
        </div>

        {/* Mensagens */}
        <div className="h-[520px] overflow-y-auto p-4 space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-2 max-w-[88%] ${msg.from === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  msg.from === 'bot' ? (msg.priority ? 'bg-red-500' : 'bg-[#25d366]') : 'bg-blue-500'
                }`}>
                  {msg.from === 'bot'
                    ? (msg.priority ? <AlertTriangle size={14} className="text-white" /> : <Bot size={14} className="text-white" />)
                    : <User size={14} className="text-white" />}
                </div>
                <div>
                  {msg.priority && <p className="text-xs text-red-600 font-bold mb-1 ml-1">⚡ ATENDIMENTO PRIORITÁRIO — DETRAN</p>}
                  <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                    msg.from === 'bot'
                      ? (msg.priority ? 'bg-red-50 border border-red-200 rounded-tl-none' : 'bg-white rounded-tl-none')
                      : 'bg-[#dcf8c6] rounded-tr-none'
                  }`}>
                    {msg.imagePreview && (
                      <img src={msg.imagePreview} alt="Documento" className="rounded-lg mb-2 max-h-40 object-cover" />
                    )}
                    <p
                      className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*(.*?)\*/g, '<strong>$1</strong>') }}
                    />
                    <p className={`text-[10px] mt-1 text-right ${msg.from === 'user' ? 'text-green-700' : 'text-gray-400'}`}>
                      {msg.time}
                    </p>
                  </div>
                  {msg.options && msg.options.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2">
                      {msg.options.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => handleOption(opt.label, opt.value)}
                          disabled={step === 'done'}
                          className={`text-left text-sm border rounded-xl px-3 py-2.5 transition-colors disabled:opacity-40 shadow-sm flex items-center gap-2 ${
                            opt.value === 'ocr_apply'
                              ? 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100'
                              : opt.value === 'ocr_skip'
                              ? 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                              : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                          }`}
                        >
                          {opt.value === 'ocr_apply' && <CheckCircle size={14} className="text-green-600 flex-shrink-0" />}
                          {opt.value === 'ocr_skip' && <XCircle size={14} className="text-gray-400 flex-shrink-0" />}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex justify-start">
              <div className="flex gap-2 items-end">
                <div className="w-8 h-8 rounded-full bg-[#25d366] flex items-center justify-center">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="bg-[#f0f0f0] px-3 py-2.5">
          {isInput ? (
            <div className="flex gap-2 items-center">
              {/* Botão de upload de documento */}
              <button
                onClick={() => fileRef.current?.click()}
                title="Enviar foto de documento para preenchimento automático"
                className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors flex-shrink-0"
              >
                <Camera size={18} />
              </button>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={PLACEHOLDERS[step] || 'Digite sua resposta...'}
                className="flex-1 bg-white rounded-full px-4 py-2.5 text-sm outline-none border border-gray-200 focus:border-blue-400"
              />
              <button onClick={handleSend} className="w-10 h-10 bg-[#075e54] rounded-full flex items-center justify-center hover:bg-[#064d45] transition-colors flex-shrink-0">
                <Send size={16} className="text-white" />
              </button>
            </div>
          ) : canUploadDoc ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-400 flex-1 text-center">👆 Selecione uma das opções acima</p>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                <FileText size={12} /> Enviar documento
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-gray-400 py-1">
              {step === 'human_transfer' ? '👤 Aguardando atendente humano...' : '👆 Selecione uma das opções acima'}
            </p>
          )}
        </div>
      </div>

      {/* Input de arquivo oculto */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  )
}

import { FastifyInstance } from 'fastify'
import Groq from 'groq-sdk'

import { PDFParse } from 'pdf-parse'

const client = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null

const MODEL = 'llama-3.1-8b-instant'

// ─── Prompts ─────────────────────────────────────────────────────────────────

const PROMPT_PCMSO_COMPLETO = `Você é especialista em documentos PCMSO (NR-7) brasileiros.
Analise o texto a seguir extraído de um PDF e extraia TODOS os dados sem omitir nenhum GHE ou cargo.
Responda APENAS com JSON puro — sem texto antes, sem texto depois, sem blocos markdown.
Use null para campos não encontrados. Nunca invente dados.

{
  "documento": { "tipo": "", "revisao": "", "data_elaboracao": "", "periodo_inicio": "", "periodo_fim": "" },
  "empresa": {
    "razao_social": "", "nome_fantasia": "", "cnpj": "", "cpf": "", "endereco": "",
    "cep": "", "bairro": "", "cidade": "", "estado": "", "telefone": "", "email": "",
    "inscricao_estadual": "", "grau_risco": "", "cnae": "", "descricao_cnae": "",
    "numero_empregados": 0, "representante_legal": ""
  },
  "consultoria": {
    "razao_social": "", "cnpj": "", "endereco": "", "cidade": "", "estado": "",
    "telefone": "", "email": "", "responsavel_legal": ""
  },
  "medicos": {
    "responsavel_pcmso": { "nome": "", "crm": "", "cpf": "", "cargo": "" },
    "examinadores": [ { "nome": "", "crm": "", "empresa": "" } ]
  },
  "historico_revisoes": [
    { "data": "", "revisao": "", "descricao": "", "empresa_responsavel": "", "profissional": "", "qualificacao": "" }
  ],
  "grupos_homogeneos_exposicao": [
    {
      "ghe": "", "quantidade_empregados": 0, "funcao": "", "cbo": "", "descricao_atividades": "",
      "riscos": [ { "risco": "", "tipo_risco": "", "tipo_exposicao": "", "danos_saude": "" } ],
      "exames": [
        { "nome": "", "codigo_esocial": "", "admissional": false, "demissional": false,
          "periodico": false, "retorno_trabalho": false, "mudanca_risco": false,
          "periodicidade": "", "obs": "" }
      ]
    }
  ],
  "cronograma_acoes": [
    { "item": 0, "acao": "", "responsavel": "", "ano": 0, "meses": [], "status": "" }
  ]
}`

const PROMPT_FUNCOES_RISCOS_EXAMES = `Analise o texto extraído do PDF a seguir.
Extraia TODAS as funções/GHEs com riscos e exames, incluindo o campo CBO de cada cargo.
Responda SOMENTE com JSON puro, sem markdown. Use null para campos não encontrados.

{
  "empresa": "",
  "grupos_homogeneos_exposicao": [
    {
      "ghe": "", "quantidade_empregados": 0, "funcao": "", "cbo": "", "descricao_atividades": "",
      "riscos": [ { "risco": "", "tipo_risco": "", "tipo_exposicao": "", "danos_saude": "" } ],
      "exames": [
        { "nome": "", "codigo_esocial": "", "admissional": false, "demissional": false,
          "periodico": false, "retorno_trabalho": false, "mudanca_risco": false,
          "periodicidade": "", "obs": "" }
      ]
    }
  ]
}`

const PROMPT_EXAMES_CARGO = `Analise o texto extraído do PDF a seguir.
Extraia os exames por cargo com CBO, periodicidade e código eSocial.
Responda SOMENTE com JSON puro, sem markdown. Use null para campos não encontrados.

{
  "empresa": "",
  "cargos": [
    {
      "cargo": "", "ghe": "", "cbo": "",
      "exames": [
        { "nome": "", "codigo_esocial": "", "admissional": false, "demissional": false,
          "periodico": false, "retorno_trabalho": false, "mudanca_risco": false,
          "periodicidade": "", "obs": "" }
      ]
    }
  ]
}`

const PROMPT_RISCOS = `Analise o texto extraído do PDF a seguir.
Extraia todos os riscos ocupacionais por GHE/cargo, incluindo o CBO de cada cargo.
Responda SOMENTE com JSON puro, sem markdown. Use null para campos não encontrados.

{
  "empresa": "",
  "riscos_por_ghe": [
    {
      "ghe": "", "funcao": "", "cbo": "",
      "riscos": [ { "risco": "", "tipo_risco": "", "tipo_exposicao": "", "danos_saude": "" } ]
    }
  ]
}`

const PROMPT_EMPRESA_MEDICO = `Analise o texto extraído do PDF a seguir.
Extraia apenas os dados da empresa, consultoria e médico responsável.
Responda SOMENTE com JSON puro, sem markdown. Use null para campos não encontrados.

{
  "empresa": {
    "razao_social": "", "nome_fantasia": "", "cnpj": "", "cpf": "",
    "endereco": "", "cep": "", "cidade": "", "estado": "",
    "telefone": "", "email": "", "grau_risco": "",
    "cnae": "", "descricao_cnae": "", "numero_empregados": 0, "representante_legal": ""
  },
  "consultoria": { "razao_social": "", "cnpj": "", "cidade": "", "telefone": "", "email": "", "responsavel_legal": "" },
  "medico_responsavel": { "nome": "", "crm": "", "cpf": "", "cargo": "" },
  "medicos_examinadores": [ { "nome": "", "crm": "", "empresa": "" } ],
  "documento": { "tipo": "", "revisao": "", "data_elaboracao": "", "periodo_inicio": "", "periodo_fim": "" }
}`

const PROMPT_ASO = `Analise o texto extraído do PDF (ASO — Atestado de Saúde Ocupacional) a seguir.
Extraia todos os dados do paciente, exame físico, aptidão e CBO.
Responda SOMENTE com JSON puro, sem markdown. Use null para campos não encontrados.

{
  "documento": { "tipo": "", "data": "", "numero": "", "clinica": "" },
  "paciente": {
    "nome": "", "cpf": "", "rg": "", "data_nascimento": "", "idade": "",
    "sexo": "", "funcao": "", "cbo": "", "setor": "", "matricula": "", "data_admissao": ""
  },
  "empresa": { "razao_social": "", "cnpj": "", "endereco": "" },
  "exame_fisico": {
    "altura": "", "peso": "", "imc": "", "pressao_arterial": "",
    "frequencia_cardiaca": "", "acuidade_visual_od": "", "acuidade_visual_oe": ""
  },
  "exames_complementares": [ { "nome": "", "resultado": "", "data": "" } ],
  "riscos_ocupacionais": [""],
  "medico": { "nome": "", "crm": "", "especialidade": "" },
  "aptidao": { "resultado": "", "restricoes": "", "validade": "", "data_proximo_exame": "" }
}`

const PROMPTS: Record<string, string> = {
  pcmso_completo: PROMPT_PCMSO_COMPLETO,
  funcoes_riscos_exames: PROMPT_FUNCOES_RISCOS_EXAMES,
  exames_cargo: PROMPT_EXAMES_CARGO,
  riscos_ocupacionais: PROMPT_RISCOS,
  empresa_medico: PROMPT_EMPRESA_MEDICO,
  aso: PROMPT_ASO,
}

const TIPO_LABELS: Record<string, string> = {
  pcmso_completo: 'PCMSO Completo (NR-7)',
  funcoes_riscos_exames: 'Funções + Riscos + Exames',
  exames_cargo: 'Exames por Cargo',
  riscos_ocupacionais: 'Riscos Ocupacionais',
  empresa_medico: 'Empresa + Médico',
  aso: 'ASO — Dados do Paciente',
  personalizado: 'Personalizado',
}

function buildCustomPrompt(instrucao: string): string {
  return `Analise o texto extraído do PDF a seguir conforme a instrução abaixo.
Responda SOMENTE com JSON puro, sem markdown. Use null para campos não encontrados.

Instrução: ${instrucao}

Defina a estrutura JSON mais adequada para os dados solicitados.`
}

async function extractWithGroq(prompt: string, docText: string): Promise<Record<string, unknown>> {
  if (!client) throw new Error('GROQ_API_KEY não configurada')
  const fullPrompt = `${prompt}\n\n--- CONTEÚDO DO DOCUMENTO ---\n${docText}`
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 3000,
    temperature: 0.1,
    messages: [{ role: 'user', content: fullPrompt }],
  })
  const raw = response.choices[0]?.message?.content?.trim() ?? '{}'
  const clean = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
  return JSON.parse(clean)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Rota ─────────────────────────────────────────────────────────────────────

export async function pcmsoRoutes(app: FastifyInstance) {
  app.get('/types', async (_request, reply) => {
    return reply.send({
      success: true,
      data: Object.entries(TIPO_LABELS).map(([value, label]) => ({ value, label })),
    })
  })

  app.post('/extract', async (request, reply) => {
    if (!client) {
      return reply.status(503).send({
        success: false,
        error: { message: 'Extração não configurada. Adicione GROQ_API_KEY ao .env.' },
      })
    }

    let pdfBuffer: Buffer | null = null
    let tiposStr = '["pcmso_completo"]'
    let instrucao = ''
    let fileName = 'documento.pdf'

    try {
      const parts = request.parts({ limits: { fileSize: 50 * 1024 * 1024 } })
      for await (const part of parts) {
        if (part.type === 'file') {
          pdfBuffer = await part.toBuffer()
          fileName = part.filename || fileName
        } else {
          if (part.fieldname === 'tipos') tiposStr = String(part.value)
          if (part.fieldname === 'instrucao') instrucao = String(part.value)
        }
      }
    } catch {
      return reply.status(400).send({ success: false, error: { message: 'Erro ao receber o arquivo.' } })
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      return reply.status(400).send({ success: false, error: { message: 'Nenhum arquivo PDF enviado.' } })
    }

    let tipos: string[] = ['pcmso_completo']
    try { tipos = JSON.parse(tiposStr) } catch { /* usa padrão */ }
    if (!Array.isArray(tipos) || tipos.length === 0) tipos = ['pcmso_completo']

    // 1. Extrai texto do PDF
    let pdfText = ''
    let numpages = 0
    try {
      const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) })
      const result = await parser.getText()
      pdfText = result.text || ''
      numpages = result.total || 0
      await parser.destroy()
    } catch (err: any) {
      request.log.error({ err: err?.message }, '[PCMSO] Falha ao parsear PDF')
      return reply.status(422).send({
        success: false,
        error: {
          message: 'Não foi possível extrair texto do PDF. Possíveis causas: PDF escaneado (imagem), PDF protegido, ou formato não suportado. Tente converter o PDF para garantir que contém texto digital.',
        },
      })
    }

    if (!pdfText || pdfText.trim().length < 30) {
      return reply.status(422).send({
        success: false,
        error: { message: 'O PDF não contém texto extraível. Provavelmente é um PDF escaneado (imagem). Use um software de OCR para converter antes de enviar.' },
      })
    }

    // llama-3.1-8b-instant free tier: 20.000 TPM
    // Prompt (~600 tokens) + texto + resposta (1500) devem ficar < 20.000
    const MAX_CHARS = 8_000
    const docText = pdfText.length > MAX_CHARS
      ? pdfText.slice(0, MAX_CHARS) + '\n[... texto truncado ...]'
      : pdfText

    // 2. Roda extrações em sequência para não estourar o limite de TPM da Groq
    const results: any[] = []
    for (let i = 0; i < tipos.length; i++) {
      const t = tipos[i]
      if (i > 0) await sleep(10000) // 10s entre requisições
      const prompt = t === 'personalizado'
        ? buildCustomPrompt(instrucao)
        : (PROMPTS[t] || PROMPTS.pcmso_completo)
      try {
        const data = await extractWithGroq(prompt, docText)
        results.push({ tipo: t, label: TIPO_LABELS[t] || t, data, error: null })
      } catch (err: any) {
        const errMsg: string = err?.message ?? ''
        const errStatus: number = err?.status ?? 0
        request.log.warn({ status: errStatus, message: errMsg }, '[PCMSO] Erro Groq')
        const isJsonErr = err instanceof SyntaxError
        const isRateLimit = [413, 429].includes(errStatus)
          || errMsg.includes('rate_limit')
          || errMsg.includes('Request too large')
          || errMsg.includes('tokens per minute')
        results.push({
          tipo: t,
          label: TIPO_LABELS[t] || t,
          data: null,
          error: isRateLimit
            ? `Limite de tokens da Groq atingido (HTTP ${errStatus || '?'}). Aguarde 1 minuto e tente novamente.`
            : isJsonErr
              ? 'A IA não retornou JSON válido para este tipo. Tente novamente.'
              : errMsg || 'Erro ao processar.',
        })
      }
    }

    request.log.info({ fileName, tipos, pages: numpages, model: MODEL }, '[PCMSO] Extração concluída')
    return reply.send({ success: true, results, meta: { fileName, tipos, pages: numpages } })
  })
}

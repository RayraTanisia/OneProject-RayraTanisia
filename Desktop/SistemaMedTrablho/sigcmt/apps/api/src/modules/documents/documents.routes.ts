import { FastifyInstance } from 'fastify'
import Groq from 'groq-sdk'
import { z } from 'zod'

const client = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null

const analyzeSchema = z.object({
  image: z.string().min(1, 'Imagem obrigatória'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  setor: z.string().optional(),
})

const PROMPT = `Você é um sistema de OCR especializado em documentos brasileiros.
Analise a imagem e extraia os dados disponíveis. Retorne APENAS um JSON válido (sem markdown, sem texto extra) com os campos:
{
  "tipoDocumento": "RG | CNH | CarteiraProfissional | FichaFuncionario | FormularioEmpresa | RENACH | CadastroEmpresa | Outro",
  "nome": "nome completo ou null",
  "cpf": "apenas números (11 dígitos) ou null",
  "rg": "número do RG ou null",
  "dataNascimento": "YYYY-MM-DD ou null",
  "empresa": "nome da empresa/empregador ou null",
  "cargo": "cargo/função ou null",
  "cnpj": "apenas números (14 dígitos) ou null",
  "razaoSocial": "razão social da empresa ou null",
  "responsavel": "nome do responsável ou null",
  "email": "e-mail ou null",
  "telefone": "apenas números ou null",
  "categoriaCNH": "A | B | C | D | E | AB | ou null",
  "numeroCNH": "número da CNH ou null",
  "edital": "nome do concurso/edital ou null",
  "observacoes": "informações relevantes não cobertas acima, ou null",
  "confianca": "alta | media | baixa"
}
Se não conseguir ler algum campo, use null. Nunca invente dados.`

export async function documentsRoutes(app: FastifyInstance) {
  app.post('/analyze', async (request, reply) => {
    if (!client) {
      return reply.status(503).send({
        success: false,
        error: { message: 'OCR não configurado. Adicione GROQ_API_KEY ao .env do servidor.' },
      })
    }

    const body = analyzeSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ success: false, error: { message: 'Dados inválidos', details: body.error.errors } })
    }

    const { image, mimeType } = body.data

    try {
      const response = await client.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${image}` },
            },
            { type: 'text', text: PROMPT },
          ],
        }],
      })

      const text = response.choices[0]?.message?.content?.trim() ?? '{}'

      let extracted: Record<string, unknown> = {}
      try {
        const clean = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
        extracted = JSON.parse(clean)
      } catch {
        return reply.status(422).send({ success: false, error: { message: 'Não foi possível interpretar o documento.' } })
      }

      return reply.send({ success: true, data: extracted })
    } catch (err: any) {
      request.log.error({ err }, '[OCR] Erro ao analisar documento')
      return reply.status(500).send({ success: false, error: { message: 'Erro ao processar documento.' } })
    }
  })
}

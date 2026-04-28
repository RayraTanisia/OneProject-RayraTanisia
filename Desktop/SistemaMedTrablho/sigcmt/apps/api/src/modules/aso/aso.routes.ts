import type { FastifyInstance } from 'fastify'
import { AsoService, createAsoSchema, listAsoSchema } from './aso.service'
import { ok, paginated } from '../../shared/plugins/errorHandler'

export async function asoRoutes(fastify: FastifyInstance) {
  const service = new AsoService()

  fastify.get('/', async (request, reply) => {
    const query = listAsoSchema.parse(request.query)
    try {
      const result = await service.list(request.currentUser.tenantId, query)
      return reply.send(paginated(result.data, result.total, result.page, result.limit))
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? '')
      if (msg.includes('does not exist') || msg.includes('relation')) {
        return reply.send(paginated([], 0, 1, 20))
      }
      throw err
    }
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const aso = await service.findById(id, request.currentUser.tenantId)
    return reply.send(ok(aso))
  })

  fastify.post('/', async (request, reply) => {
    const body = createAsoSchema.parse(request.body)
    const aso = await service.create(request.currentUser.tenantId, request.currentUser.id, body)
    return reply.status(201).send(ok(aso))
  })

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await service.delete(id, request.currentUser.tenantId)
    return reply.send(ok({ message: 'ASO excluído.' }))
  })
}

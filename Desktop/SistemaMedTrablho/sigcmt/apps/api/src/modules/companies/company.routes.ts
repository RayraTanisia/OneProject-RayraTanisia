import type { FastifyInstance } from 'fastify'
import { CompanyService, createCompanySchema, updateCompanySchema, listCompanySchema } from './company.service'
import { ok, paginated } from '../../shared/plugins/errorHandler'

export async function companyRoutes(fastify: FastifyInstance) {
  const service = new CompanyService()

  fastify.get('/', async (request, reply) => {
    const query = listCompanySchema.parse(request.query)
    const result = await service.list(request.currentUser.tenantId, query)
    return reply.send(paginated(result.data, result.total, result.page, result.limit))
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const company = await service.findById(id, request.currentUser.tenantId)
    return reply.send(ok(company))
  })

  fastify.post('/', async (request, reply) => {
    const body = createCompanySchema.parse(request.body)
    const company = await service.create(request.currentUser.tenantId, body)
    return reply.status(201).send(ok(company))
  })

  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updateCompanySchema.parse(request.body)
    const company = await service.update(id, request.currentUser.tenantId, body)
    return reply.send(ok(company))
  })

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await service.delete(id, request.currentUser.tenantId)
    return reply.send(ok({ message: 'Empresa desativada com sucesso.' }))
  })
}

import type { FastifyInstance } from 'fastify'
import { AuthService, loginSchema, registerTenantSchema } from './auth.service'
import { ok } from '../../shared/plugins/errorHandler'

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify)

  // POST /api/v1/auth/login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const result = await authService.login(body.email, body.password, body.tenantSlug)
    return reply.status(200).send(ok(result))
  })

  // POST /api/v1/auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string }
    if (!refreshToken) return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'refreshToken obrigatório.' } })
    const result = await authService.refresh(refreshToken)
    return reply.status(200).send(ok(result))
  })

  // POST /api/v1/auth/logout
  fastify.post('/logout', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string }
    if (refreshToken) await authService.logout(refreshToken)
    return reply.status(200).send(ok({ message: 'Logout realizado com sucesso.' }))
  })

  // POST /api/v1/auth/register (criar nova clínica)
  fastify.post('/register', async (request, reply) => {
    const body = registerTenantSchema.parse(request.body)
    const result = await authService.registerTenant(body)
    return reply.status(201).send(ok(result))
  })

  // GET /api/v1/auth/me (protegido)
  fastify.get('/me', {
    onRequest: [async (req, rep) => {
      try {
        await req.jwtVerify()
      } catch {
        return rep.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Não autenticado.' } })
      }
    }],
  }, async (request, reply) => {
    const payload = request.user as { sub: string }
    const result = await authService.me(payload.sub)
    return reply.status(200).send(ok(result))
  })
}

import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@sigcmt/database'

const AUDITED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']
const SKIP_PATHS = ['/health', '/api/v1/auth/refresh', '/docs']

export async function auditMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (!AUDITED_METHODS.includes(request.method)) return
    if (SKIP_PATHS.some(p => request.url.startsWith(p))) return
    if (!request.currentUser) return

    const action = `${request.method} ${request.url}`
    const resourceType = request.url.split('/')[3] || 'unknown'
    const resourceId = (request.params as Record<string, string>)?.id

    await prisma.auditLog.create({
      data: {
        tenantId: request.currentUser.tenantId,
        userId: request.currentUser.id,
        action,
        resourceType,
        resourceId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']?.slice(0, 255),
        newValue: reply.statusCode < 400 ? { statusCode: reply.statusCode } : undefined,
      },
    })
  } catch {
    // Não bloquear a resposta por falha de auditoria
  }
}

import type { FastifyRequest, FastifyReply } from 'fastify'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const payload = request.user as {
      sub: string
      tenantId: string
      role: string
      permissions: string[]
      name: string
    }
    request.currentUser = {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      permissions: payload.permissions ?? [],
      fullName: payload.name,
    }
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Token inválido ou expirado. Faça login novamente.' },
    })
  }
}

export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.currentUser
    if (!user) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Não autenticado.' } })
    }
    const hasPermission =
      user.permissions.includes('*') ||
      user.permissions.includes(permission) ||
      user.role === 'ADMIN'
    if (!hasPermission) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: `Permissão necessária: ${permission}` },
      })
    }
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.currentUser
    if (!user) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Não autenticado.' } })
    }
    if (user.role !== 'ADMIN' && !roles.includes(user.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Acesso não autorizado para sua função.' },
      })
    }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: {
      id: string
      tenantId: string
      role: string
      permissions: string[]
      fullName: string
    }
  }
}

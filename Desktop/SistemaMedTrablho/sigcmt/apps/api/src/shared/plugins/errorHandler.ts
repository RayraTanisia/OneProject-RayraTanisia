import type { FastifyRequest, FastifyReply, FastifyError } from 'fastify'
import { ZodError } from 'zod'

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  request.log.error(error)

  // Erro de validação Zod
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
      },
      meta: { timestamp: new Date().toISOString(), requestId: request.id },
    })
  }

  // Rate limit
  if (error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: { code: 'RATE_LIMIT', message: 'Muitas requisições.' },
      meta: { timestamp: new Date().toISOString(), requestId: request.id },
    })
  }

  // Erros conhecidos da aplicação
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      success: false,
      error: { code: 'CLIENT_ERROR', message: error.message },
      meta: { timestamp: new Date().toISOString(), requestId: request.id },
    })
  }

  // Erro interno
  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno do servidor.',
    },
    meta: { timestamp: new Date().toISOString(), requestId: request.id },
  })
}

// Helpers de resposta padronizada
export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return {
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), ...meta },
  }
}

export function paginated<T>(data: T[], total: number, page: number, limit: number) {
  return {
    success: true,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      timestamp: new Date().toISOString(),
    },
  }
}

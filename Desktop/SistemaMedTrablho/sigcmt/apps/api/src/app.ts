import './env'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

import { testConnection } from './shared/services/email.service'
import { authRoutes } from './modules/auth/auth.routes'
import { patientRoutes } from './modules/patients/patient.routes'
import { appointmentRoutes } from './modules/appointments/appointment.routes'
import { userRoutes } from './modules/auth/user.routes'
import { companyRoutes } from './modules/companies/company.routes'
import { asoRoutes } from './modules/aso/aso.routes'
import { reportsRoutes } from './modules/reports/reports.routes'
import { receptionRoutes, publicCheckinRoutes } from './modules/reception/reception.routes'
import { chatbotRoutes } from './modules/reception/chatbot.routes'
import { documentsRoutes } from './modules/documents/documents.routes'
import { pcmsoRoutes } from './modules/pcmso/pcmso.routes'
import { authenticate } from './shared/middleware/authenticate'
import { auditMiddleware } from './shared/middleware/audit'
import { errorHandler } from './shared/plugins/errorHandler'

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
  },
})

async function build() {
  // Security
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = [
        process.env.FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
      ].filter(Boolean) as string[]
      if (!origin || allowed.some(o => origin.startsWith(o))) return cb(null, true)
      // Permite domínios Vercel (*.vercel.app) automaticamente
      if (origin.endsWith('.vercel.app')) return cb(null, true)
      cb(new Error('CORS'), false)
    },
    credentials: true,
  })
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      success: false,
      error: { code: 'RATE_LIMIT', message: 'Muitas requisições. Tente novamente em instantes.' },
    }),
  })

  // File upload
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }) // 50MB (PCMSOs podem ser grandes)

  // JWT
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'fallback-secret',
    sign: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
  })

  // Swagger (dev only)
  if (process.env.NODE_ENV === 'development') {
    await app.register(swagger, {
      openapi: {
        info: { title: 'SIGCMT API', version: '1.0.0', description: 'API do Sistema de Gestão de Clínica de Medicina do Trabalho' },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
    })
    await app.register(swaggerUi, { routePrefix: '/docs' })
  }

  // Error handler global
  app.setErrorHandler(errorHandler)

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV,
  }))

  // Teste de SMTP (público)
  app.get('/test-email', async () => testConnection())

  // Rotas públicas (sem auth)
  await app.register(authRoutes, { prefix: '/api/v1/auth' })
  await app.register(publicCheckinRoutes, { prefix: '/api/v1/public/checkin' })
  await app.register(chatbotRoutes, { prefix: '/api/v1/public/chatbot' })

  // Rotas protegidas
  await app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', authenticate)
    protectedApp.addHook('onResponse', auditMiddleware)

    await protectedApp.register(userRoutes, { prefix: '/api/v1/users' })
    await protectedApp.register(patientRoutes, { prefix: '/api/v1/patients' })
    await protectedApp.register(appointmentRoutes, { prefix: '/api/v1/appointments' })
    await protectedApp.register(companyRoutes, { prefix: '/api/v1/companies' })
    await protectedApp.register(asoRoutes, { prefix: '/api/v1/asos' })
    await protectedApp.register(reportsRoutes, { prefix: '/api/v1/reports' })
    await protectedApp.register(receptionRoutes, { prefix: '/api/v1/reception' })
    await protectedApp.register(documentsRoutes, { prefix: '/api/v1/documents' })
    await protectedApp.register(pcmsoRoutes, { prefix: '/api/v1/pcmso' })
  })

  return app
}

async function start() {
  try {
    const server = await build()
    const port = parseInt(process.env.PORT || '3001')
    const host = process.env.HOST || '0.0.0.0'
    await server.listen({ port, host })
    console.log(`\n🚀 SIGCMT API rodando em http://localhost:${port}`)
    console.log(`📚 Swagger UI em http://localhost:${port}/docs\n`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()

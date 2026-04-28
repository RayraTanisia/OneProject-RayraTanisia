import { prisma } from '@sigcmt/database'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
  tenantSlug: z.string().optional(),
})

export const registerTenantSchema = z.object({
  tenantName: z.string().min(3, 'Nome da clínica deve ter ao menos 3 caracteres'),
  tenantSlug: z.string().min(3).regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  adminName: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  adminEmail: z.string().email('E-mail inválido'),
  adminPassword: z.string()
    .min(8, 'Senha deve ter ao menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve ter ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'Senha deve ter ao menos um número')
    .regex(/[^A-Za-z0-9]/, 'Senha deve ter ao menos um caractere especial'),
})

export class AuthService {
  constructor(private fastify: FastifyInstance) {}

  async login(email: string, password: string, tenantSlug?: string) {
    // Buscar usuário (com tenant se slug fornecido)
    const whereClause = tenantSlug
      ? { email, tenant: { slug: tenantSlug }, active: true }
      : { email, active: true }

    const user = await prisma.user.findFirst({
      where: whereClause,
      include: { tenant: { select: { id: true, name: true, slug: true, active: true } } },
    })

    if (!user || !user.tenant.active) {
      throw { statusCode: 401, message: 'E-mail ou senha inválidos.' }
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash)
    if (!validPassword) {
      throw { statusCode: 401, message: 'E-mail ou senha inválidos.' }
    }

    // Gerar tokens
    const accessToken = this.fastify.jwt.sign({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      permissions: user.permissions,
      name: user.fullName,
    })

    const refreshToken = randomBytes(64).toString('hex')
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex')

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
      },
    })

    // Atualizar last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        permissions: user.permissions,
        photoUrl: user.photoUrl,
        tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug },
      },
    }
  }

  async refresh(refreshToken: string) {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex')

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { tenant: true } } },
    })

    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.usedAt) {
      throw { statusCode: 401, message: 'Refresh token inválido ou expirado.' }
    }

    if (!stored.user.active || !stored.user.tenant.active) {
      throw { statusCode: 401, message: 'Usuário ou clínica inativa.' }
    }

    // Marcar token antigo como usado (rotation)
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    })

    // Gerar novo par de tokens
    const newAccessToken = this.fastify.jwt.sign({
      sub: stored.user.id,
      tenantId: stored.user.tenantId,
      role: stored.user.role,
      permissions: stored.user.permissions,
      name: stored.user.fullName,
    })

    const newRefreshToken = randomBytes(64).toString('hex')
    const newRefreshHash = createHash('sha256').update(newRefreshToken).digest('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await prisma.refreshToken.create({
      data: { userId: stored.user.id, tokenHash: newRefreshHash, expiresAt },
    })

    return { accessToken: newAccessToken, refreshToken: newRefreshToken }
  }

  async logout(refreshToken: string) {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex')
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    })
  }

  async registerTenant(data: z.infer<typeof registerTenantSchema>) {
    const existingTenant = await prisma.tenant.findUnique({ where: { slug: data.tenantSlug } })
    if (existingTenant) throw { statusCode: 409, message: 'Slug já em uso. Escolha outro.' }

    const passwordHash = await bcrypt.hash(data.adminPassword, 12)

    const tenant = await prisma.tenant.create({
      data: {
        name: data.tenantName,
        slug: data.tenantSlug,
        users: {
          create: {
            email: data.adminEmail,
            passwordHash,
            fullName: data.adminName,
            role: 'ADMIN',
            permissions: ['*'],
          },
        },
      },
    })

    return { tenantId: tenant.id, slug: tenant.slug, message: 'Clínica criada com sucesso. Faça login para continuar.' }
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, fullName: true, role: true, permissions: true,
        crmNumber: true, crmState: true, photoUrl: true, phone: true,
        tenant: { select: { id: true, name: true, slug: true, logoUrl: true, settings: true } },
      },
    })
    if (!user) throw { statusCode: 404, message: 'Usuário não encontrado.' }
    return user
  }
}

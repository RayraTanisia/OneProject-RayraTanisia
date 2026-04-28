import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

const ENCRYPTION_KEY = (process.env.ENCRYPTION_KEY || 'sigcmt-dev-key-32-bytes-long!!!!').padEnd(32).slice(0, 32)

export function encrypt(value: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decrypt(encryptedValue: string): string {
  const [ivHex, encryptedHex] = encryptedValue.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function hashForSearch(value: string, tenantId: string): string {
  return createHash('sha256').update(value.replace(/\D/g, '') + tenantId).digest('hex')
}

export function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null
  try { return decrypt(value) } catch { return null }
}

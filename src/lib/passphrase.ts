import { createHash } from 'crypto'

export function hashPassphrase(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function verifyPassphrase(raw: string, hash: string): boolean {
  return hashPassphrase(raw) === hash
}

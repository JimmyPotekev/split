import { NextResponse } from 'next/server'
import { verifyPassphrase } from './passphrase'

export function checkPassphrase(
  req: Request,
  passphraseHash: string | null,
): NextResponse | null {
  if (!passphraseHash) return null
  const pass = req.headers.get('x-group-pass')
  if (!pass || !verifyPassphrase(pass, passphraseHash)) {
    return NextResponse.json(
      { error: 'Passphrase required.', code: 'PASSPHRASE_REQUIRED' },
      { status: 403 },
    )
  }
  return null
}

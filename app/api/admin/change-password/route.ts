import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  requireAdmin,
  AdminUnauthorizedError,
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_OPTIONS,
} from '@/lib/admin-auth'

const MIN_LENGTH = 12
const FORBIDDEN_SUBSTRING = /saveyours/i

export async function POST(req: NextRequest) {
  let admin
  try {
    admin = await requireAdmin(req)
  } catch (e) {
    if (e instanceof AdminUnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    throw e
  }

  const body = await req.json().catch(() => ({}))
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Both current and new password are required' }, { status: 400 })
  }
  if (newPassword.length < MIN_LENGTH) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_LENGTH} characters` },
      { status: 400 }
    )
  }
  if (FORBIDDEN_SUBSTRING.test(newPassword)) {
    return NextResponse.json(
      { error: 'New password must not contain "saveyours"' },
      { status: 400 }
    )
  }
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'New password must be different from current password' },
      { status: 400 }
    )
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, password_hash, session_epoch')
    .eq('id', admin.adminId)
    .eq('role', 'admin')
    .maybeSingle()

  if (error || !user || !user.password_hash) {
    console.error('[CHANGE_PASSWORD] Admin row not found for session:', admin.adminId, error)
    return NextResponse.json({ error: 'Account not found' }, { status: 500 })
  }

  const currentOk = await bcrypt.compare(currentPassword, user.password_hash)
  if (!currentOk) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
  }

  const newHash = await bcrypt.hash(newPassword, 10)
  // Bumping session_epoch is what makes this a global logout: every existing
  // admin_session cookie carries the old epoch value, so requireAdmin's DB
  // check will now 401 them on their very next request across all devices.
  const newEpoch = (user.session_epoch ?? 0) + 1
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ password_hash: newHash, session_epoch: newEpoch })
    .eq('id', admin.adminId)

  if (updateError) {
    console.error('[CHANGE_PASSWORD] Failed to update hash/epoch:', updateError)
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }

  // Also clear the cookie on THIS browser so the response leaves no valid
  // session behind. Other devices will 401 on their next request via the
  // epoch mismatch above.
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE_NAME, '', { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 })
  return res
}

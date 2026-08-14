import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, AdminUnauthorizedError } from '@/lib/admin-auth'

// Lightweight probe for the client: is the current admin_session cookie valid?
// Returns 200 with { email } if so, 401 otherwise. Admin pages call this on
// mount to decide whether to show the login form or the dashboard.
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    return NextResponse.json({ ok: true, email: admin.email })
  } catch (e) {
    if (e instanceof AdminUnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    throw e
  }
}

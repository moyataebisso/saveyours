import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  issueAdminSession,
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_OPTIONS,
} from '@/lib/admin-auth'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, password_hash')
      .eq('email', email)
      .eq('role', 'admin')
      .maybeSingle()

    if (error || !user || !user.password_hash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const session = issueAdminSession({ adminId: user.id, email: user.email })
    const res = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.full_name,
      role: user.role,
    })
    res.cookies.set(ADMIN_COOKIE_NAME, session.value, {
      ...ADMIN_COOKIE_OPTIONS,
      maxAge: session.maxAge,
    })
    return res
  } catch (err) {
    console.error('[ADMIN_LOGIN]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

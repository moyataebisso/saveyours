import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkFormSubmission } from '@/lib/form-guard';

// Student login only. Admin login lives at /api/admin/login and issues a
// signed HttpOnly session cookie; this route intentionally does not.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // Silent-accept for login is a 401 (indistinguishable from a real bad
    // password). Not a 200 success shape — that would hand the caller a
    // fake user and route them into the dashboard. Bots learn nothing about
    // which check tripped either way.
    const guard = checkFormSubmission(request, body, {
      formName: 'login',
      honeypot: true,
      emailField: 'email',
      rateLimit: { maxPerHour: 10, identifierField: 'email' },
    });
    if (guard.decision === 'silent-accept') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .neq('role', 'admin')
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

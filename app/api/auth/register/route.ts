import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkFormSubmission } from '@/lib/form-guard';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const guard = checkFormSubmission(request, body, {
      formName: 'register',
      honeypot: true,
      timing: { minSeconds: 3 },
      gibberishFields: ['name'],
      emailField: 'email',
      rateLimit: { maxPerHour: 3, identifierField: 'email' },
    });
    if (guard.decision === 'silent-accept') {
      // Generic soft failure — same message for every silent-accept reason
      // so a bot learns nothing from response differentiation, and a
      // legitimate user who somehow trips a check gets a concrete path
      // forward instead of a fake success + failed login later.
      return NextResponse.json(
        {
          error:
            "We couldn't complete your registration. Please email info@saveyours.net and we'll get you set up.",
        },
        { status: 400 }
      );
    }

    const { name, email, password } = body ?? {};

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user matching YOUR schema exactly
    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        password_hash: hashedPassword,
        full_name: name,
        phone: null,
        role: 'student',
        email_verified: false
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'User created successfully',
      user: { email: newUser.email, name: newUser.full_name }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

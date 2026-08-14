import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

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

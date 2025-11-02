import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';

// Hardcoded admin credentials (same as in /api/admin/login)
const ADMIN_CREDENTIALS = {
  email: 'info@saveyours.net',
  password: 'SaveYours2024!',
  name: 'Meea Mosissa',
  id: '07ade784-c858-4f23-8f69-d9791c69d656'
};

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    
    console.log('Login attempt for:', email);
    
    // First check if it's the hardcoded admin
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      console.log('Admin login successful');
      return NextResponse.json({
        message: 'Login successful',
        user: {
          id: ADMIN_CREDENTIALS.id,
          email: ADMIN_CREDENTIALS.email,
          name: ADMIN_CREDENTIALS.name,
          role: 'admin'
        }
      });
    }
    
    // If not admin, check regular users in database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !user) {
      console.log('User not found:', email);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    console.log('User found, checking password...');
    
    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      console.log('Password mismatch for:', email);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    console.log('Login successful for:', email);
    
    // Return user data (without password)
    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
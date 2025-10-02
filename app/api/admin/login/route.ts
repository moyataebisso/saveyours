// app/api/admin/login/route.ts
import { NextResponse } from 'next/server';

// Simple authentication without bcrypt for now
const ADMIN_CREDENTIALS = {
  email: 'info@saveyours.net',
  password: 'SaveYours2024!',
  name: 'Meea Mosissa',
  id: '07ade784-c858-4f23-8f69-d9791c69d656' // From your database
};

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    
    console.log('Login attempt for:', email);

    // Simple direct check
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      console.log('Login successful');
      return NextResponse.json({
        id: ADMIN_CREDENTIALS.id,
        email: ADMIN_CREDENTIALS.email,
        name: ADMIN_CREDENTIALS.name,
        role: 'admin'
      });
    }

    console.log('Invalid credentials');
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  // Get credentials from environment variables
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@saveyours.net';
  const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

  // Hash the provided password
  const passwordHash = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');

  if (email === ADMIN_EMAIL && passwordHash === ADMIN_PASSWORD_HASH) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}
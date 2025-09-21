import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
    stripeSecretFirst10: process.env.STRIPE_SECRET_KEY?.substring(0, 10) || 'NOT_SET',
    hasStripePublic: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    stripePublicFirst10: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.substring(0, 10) || 'NOT_SET',
    allEnvKeys: Object.keys(process.env).filter(key => 
      key.includes('STRIPE') || key.includes('SUPABASE')
    ),
  });
}
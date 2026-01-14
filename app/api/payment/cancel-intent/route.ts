import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe-server';

export async function POST(req: NextRequest) {
  try {
    const { paymentIntentId } = await req.json();

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'No payment intent ID' }, { status: 400 });
    }

    // Cancel the payment intent
    await stripe.paymentIntents.cancel(paymentIntentId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // If already cancelled or captured, that's fine
    if (error.code === 'payment_intent_unexpected_state') {
      return NextResponse.json({ success: true });
    }
    console.error('Cancel intent error:', error);
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 });
  }
}

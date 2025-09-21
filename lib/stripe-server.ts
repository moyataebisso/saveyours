import Stripe from 'stripe';

// This file should ONLY be imported in API routes, never in client components
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});
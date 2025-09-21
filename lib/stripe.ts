import { loadStripe } from '@stripe/stripe-js';

// Client-side only - this is all you need for the cart page
let stripePromise: ReturnType<typeof loadStripe> | null = null;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
};

// Server-side Stripe should ONLY be used in API routes
// Create a separate file for server-side Stripe
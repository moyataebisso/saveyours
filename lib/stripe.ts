export const stripePromise = {
  redirectToCheckout: async () => {
    console.log('Mock Stripe checkout');
    alert('Stripe checkout will be configured after setup');
    return { error: null };
  }
};
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { getStripe } from '@/lib/stripe';
import { toast } from '@/components/ui/Toaster';
import { Trash2, X } from 'lucide-react';
import type { ClassSessionWithClass } from '@/types';

interface CheckoutFormProps {
  sessions: ClassSessionWithClass[];
  totalAmount: number;
  paymentIntentId: string;
}

function CheckoutForm({ sessions, totalAmount, paymentIntentId }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) return;
    
    if (!formData.name || !formData.email) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: `${window.location.origin}/success`,
        receipt_email: formData.email,
      },
    });

    if (error) {
      toast.error(error.message || 'Payment failed');
      setLoading(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        // Create enrollment for each session
        for (const session of sessions) {
          await fetch('/api/enrollment/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: session.id,
              email: formData.email,
              name: formData.name,
              phone: formData.phone,
              paymentIntentId: paymentIntent.id
            })
          });
        }

        localStorage.removeItem('cart');
        window.dispatchEvent(new Event('storage'));
        router.push(`/success?payment_intent=${paymentIntent.id}`);
      } catch (err) {
        toast.error('Failed to complete enrollment');
        setLoading(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Student Information</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name *
          </label>
          <input
            type="text"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="John Doe"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address *
          </label>
          <input
            type="email"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            placeholder="john@example.com"
          />
          <p className="text-xs text-gray-500 mt-1">
            We will send your confirmation and online course access to this email
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            placeholder="(555) 123-4567"
          />
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Payment Information</h3>
        <PaymentElement />
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
        <p className="text-sm text-yellow-800">
          <strong>Important:</strong> After payment, you will receive an email within 24 hours 
          with instructions to complete the online portion before attending the in-person session.
        </p>
      </div>

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Processing...' : `Complete Registration - $${totalAmount}`}
      </button>
    </form>
  );
}

export default function CartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<ClassSessionWithClass[]>([]);
  const [clientSecret, setClientSecret] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  const totalAmount = cartItems.reduce((sum, item) => sum + (item.class?.price || 0), 0);

  const removeFromCart = (sessionId: string) => {
    const updatedCart = cartItems.filter(item => item.id !== sessionId);
    setCartItems(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    window.dispatchEvent(new Event('storage'));
    
    if (updatedCart.length === 0) {
      router.push('/classes');
    }
    
    toast.success('Item removed from cart');
  };

  const clearCart = () => {
    localStorage.removeItem('cart');
    window.dispatchEvent(new Event('storage'));
    router.push('/classes');
  };

  useEffect(() => {
    // Initialize Stripe
    const initializeStripe = async () => {
      const stripe = await getStripe();
      setStripePromise(Promise.resolve(stripe));
    };
    initializeStripe();

    // Get cart items from localStorage
    const cart = JSON.parse(localStorage.getItem('cart') || '[]') as ClassSessionWithClass[];
    
    if (cart.length === 0) {
      router.push('/classes');
      return;
    }

    setCartItems(cart);
    
    // Create payment intent for total amount
    const total = cart.reduce((sum, item) => sum + (item.class?.price || 0), 0);
    
    fetch('/api/payment/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sessionId: cart[0].id, // Use first session for metadata
        totalAmount: total // Pass total if multiple items
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        toast.error(data.error);
        router.push('/classes');
      } else {
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setLoading(false);
      }
    })
    .catch(err => {
      console.error('Error creating payment intent:', err);
      toast.error('Failed to initialize checkout');
      router.push('/classes');
    });
  }, [router]);

  if (loading || !clientSecret || cartItems.length === 0 || !stripePromise) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <h1 className="text-3xl font-bold mb-8">Complete Your Registration</h1>
        
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {/* Cart Items Display */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-lg">Your Classes ({cartItems.length})</h2>
                <button
                  onClick={clearCart}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Clear Cart
                </button>
              </div>
              
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium">{item.class.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(item.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })} • {item.start_time} - {item.end_time}
                      </p>
                      <p className="text-sm text-gray-600">
                        {item.class.audience === 'healthcare' ? 'Healthcare' : 'General Public'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold">${item.class.price}</span>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove from cart"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Checkout Form */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <Elements 
                stripe={stripePromise} 
                options={{ 
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#DC2626',
                    },
                  },
                }}
              >
                <CheckoutForm 
                  sessions={cartItems}
                  totalAmount={totalAmount}
                  paymentIntentId={paymentIntentId}
                />
              </Elements>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h2 className="font-semibold text-lg mb-4">Order Summary</h2>
              
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="pb-3 border-b last:border-0">
                    <p className="font-medium text-sm">{item.class.name}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(item.date).toLocaleDateString()} at {item.start_time}
                    </p>
                    <p className="text-sm font-semibold mt-1">${item.class.price}</p>
                  </div>
                ))}
                
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Subtotal</span>
                    <span className="text-sm">${totalAmount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-lg">Total</span>
                    <span className="text-2xl font-bold text-primary-600">
                      ${totalAmount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
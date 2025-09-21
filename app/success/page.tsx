'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const paymentIntent = searchParams.get('payment_intent');

  useEffect(() => {
    // Clear cart after successful payment
    localStorage.removeItem('cart');
    window.dispatchEvent(new Event('storage'));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Registration Successful!
          </h1>
          
          <p className="text-gray-600 mb-6">
            Thank you for registering. You will receive a confirmation email shortly 
            with details about your class and instructions for completing the online portion.
          </p>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded text-left mb-6">
            <p className="text-sm text-yellow-800">
              <strong>Next Steps:</strong><br />
              1. Check your email for confirmation<br />
              2. Complete online course (link in email)<br />
              3. Attend in-person skills session
            </p>
          </div>

          <Link 
            href="/classes"
            className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 inline-block"
          >
            Browse More Classes
          </Link>
        </div>
      </div>
    </div>
  );
}
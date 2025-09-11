'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trash2, ShoppingCart, Clock, Calendar, MapPin, ChevronRight } from 'lucide-react';
import { toast } from '@/components/ui/Toaster';

interface CartItem {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  class?: {
    name: string;
    price: number;
    type: string;
  };
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = () => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCartItems(cart);
    setLoading(false);
  };

  const removeFromCart = (sessionId: string) => {
    const updatedCart = cartItems.filter(item => item.id !== sessionId);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    setCartItems(updatedCart);
    window.dispatchEvent(new Event('storage'));
    toast.success('Removed from cart');
  };

  const clearCart = () => {
    localStorage.setItem('cart', '[]');
    setCartItems([]);
    window.dispatchEvent(new Event('storage'));
    toast.success('Cart cleared');
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => total + (item.class?.price || 0), 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="container-custom py-12">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

        {cartItems.length === 0 ? (
          <div className="card p-12 text-center">
            <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
            <p className="text-gray-600 mb-6">Add some classes to get started!</p>
            <Link href="/classes" className="btn btn-primary">
              Browse Classes
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <div key={item.id} className="card p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{item.class?.name}</h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          {new Date(item.date).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          {item.start_time} - {item.end_time}
                        </div>
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-2" />
                          Minneapolis, MN
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-2xl font-bold text-primary-600 mb-2">
                        ${item.class?.price}
                      </p>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-600 hover:text-red-700 text-sm flex items-center"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={clearCart}
                className="text-gray-600 hover:text-gray-700 text-sm"
              >
                Clear Cart
              </button>
            </div>

            <div className="lg:col-span-1">
              <div className="card p-6 sticky top-24">
                <h2 className="font-semibold text-lg mb-4">Order Summary</h2>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Classes ({cartItems.length})</span>
                    <span>${calculateTotal().toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span className="text-primary-600">${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <button className="btn btn-primary w-full">
                  Proceed to Checkout
                  <ChevronRight className="w-4 h-4 ml-2" />
                </button>

                <p className="text-xs text-gray-500 mt-4 text-center">
                  Secure checkout powered by Stripe
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
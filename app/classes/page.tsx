'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, ShoppingCart, Filter, List, Users } from 'lucide-react';
import { toast } from '@/components/ui/Toaster';
import { supabaseHelpers } from '@/lib/supabase';

interface ClassSession {
  id: string;
  class_id: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  max_capacity: number;
  current_enrollment: number;
  status: string;
  class?: {
    id: string;
    name: string;
    type: string;
    audience: string;
    price: number;
    duration_online: number;
    duration_skills: number;
    description: string;
  };
}

export default function ClassesPage() {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'healthcare' | 'general'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const { data } = await supabaseHelpers.getAvailableSessions();
    setSessions(data || []);
    setLoading(false);
  };

  const filteredSessions = sessions.filter(session => {
    if (filter === 'all') return true;
    return session.class?.audience === filter;
  });

  const addToCart = (session: ClassSession) => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]') as ClassSession[];
    if (cart.find(item => item.id === session.id)) {
      toast.info('This class is already in your cart');
      return;
    }
    cart.push(session);
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('storage'));
    toast.success('Added to cart!');
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
      <section className="bg-white border-b">
        <div className="container-custom py-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Available Classes</h1>
          <p className="text-gray-600">Choose from our professional CPR and First Aid certification courses</p>
        </div>
      </section>

      <section className="bg-white border-b sticky top-[73px] z-30">
        <div className="container-custom py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-md flex items-center transition-colors ${
                  viewMode === 'list' ? 'bg-white shadow-sm' : ''
                }`}
              >
                <List className="w-4 h-4 mr-2" />
                List
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-4 py-2 rounded-md flex items-center transition-colors ${
                  viewMode === 'calendar' ? 'bg-white shadow-sm' : ''
                }`}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Calendar
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'all' | 'healthcare' | 'general')}
                className="input py-2"
              >
                <option value="all">All Classes</option>
                <option value="healthcare">Healthcare Workers</option>
                <option value="general">General Public</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="container-custom py-8">
        {viewMode === 'list' ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map((session) => (
              <div key={session.id} className="card hover:shadow-xl transition-all">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{session.class?.name}</h3>
                      <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                        session.class?.audience === 'healthcare' 
                          ? 'bg-primary-100 text-primary-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {session.class?.audience === 'healthcare' ? 'Healthcare' : 'General Public'}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-primary-600">
                      ${session.class?.price}
                    </p>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(session.date).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      {session.start_time} - {session.end_time}
                    </div>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2" />
                      Minneapolis, MN
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      {session.max_capacity - session.current_enrollment} spots available
                    </div>
                  </div>

                  <button
                    onClick={() => addToCart(session)}
                    className="btn btn-primary w-full text-sm"
                    disabled={session.current_enrollment >= session.max_capacity}
                  >
                    {session.current_enrollment >= session.max_capacity ? (
                      'Class Full'
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Add to Cart
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-center text-gray-500">Calendar view coming soon!</p>
          </div>
        )}

        {filteredSessions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No classes available for the selected filter.</p>
          </div>
        )}
      </section>
    </div>
  );
}
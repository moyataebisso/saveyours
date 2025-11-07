'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, ShoppingCart, Filter, List, Users, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      console.log('Starting to load sessions...');
      console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      
      const { data, error } = await supabaseHelpers.getAvailableSessions();
      
      console.log('Raw response - Data:', data);
      console.log('Raw response - Error:', error);
      
      if (error) {
        console.error('Supabase error details:', error);
      }
      
      if (data) {
        console.log('Number of sessions found:', data.length);
        console.log('First session (if any):', data[0]);
      }
      
      setSessions(data || []);
      setLoading(false);
    } catch (err) {
      console.error('Caught error:', err);
      setLoading(false);
    }
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

  // Calendar functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getSessionsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return filteredSessions.filter(session => 
      session.date.split('T')[0] === dateStr
    );
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-24 bg-gray-50 border border-gray-200"></div>
      );
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const daysSessions = getSessionsForDate(date);
      const isToday = date.toDateString() === new Date().toDateString();
      const isSelected = selectedDate?.toDateString() === date.toDateString();
      
      days.push(
        <div
          key={day}
          onClick={() => daysSessions.length > 0 && setSelectedDate(date)}
          className={`h-24 border border-gray-200 p-2 cursor-pointer hover:bg-gray-50 transition-colors ${
            isToday ? 'bg-blue-50' : 'bg-white'
          } ${isSelected ? 'ring-2 ring-primary-500' : ''} ${
            daysSessions.length > 0 ? 'cursor-pointer' : ''
          }`}
        >
          <div className="flex justify-between items-start mb-1">
            <span className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
              {day}
            </span>
            {daysSessions.length > 0 && (
              <span className="bg-primary-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {daysSessions.length}
              </span>
            )}
          </div>
          
          {/* Show first 2 classes for this day */}
          <div className="space-y-1">
            {daysSessions.slice(0, 2).map((session, idx) => (
              <div
                key={session.id}
                className={`text-xs p-1 rounded truncate ${
                  session.class?.audience === 'healthcare' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {session.start_time} - {session.class?.name.split(' ').slice(0, 2).join(' ')}
              </div>
            ))}
            {daysSessions.length > 2 && (
              <div className="text-xs text-gray-500">
                +{daysSessions.length - 2} more
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return days;
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
          <p className="text-gray-600">Select from our full range of American Red Cross certified courses: BLS for healthcare providers, Adult and Pediatric First Aid/CPR/AED for non-healthcare workers, and on-site mobile training tailored to your group needs.</p>
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
                <option value="healthcare">BLS</option>
                <option value="general">CPR/AED/First Aid</option>
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
                      {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { 
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
          <div className="bg-white rounded-lg shadow-md">
            {/* Calendar Header */}
            <div className="p-6 border-b flex justify-between items-center">
              <button
                onClick={previousMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <h2 className="text-xl font-semibold">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="p-6">
              {/* Week days header */}
              <div className="grid grid-cols-7 gap-0 mb-2">
                {weekDays.map(day => (
                  <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-0">
                {renderCalendar()}
              </div>
            </div>

            {/* Selected Date Details */}
            {selectedDate && getSessionsForDate(selectedDate).length > 0 && (
              <div className="border-t p-6">
                <h3 className="font-semibold text-lg mb-4">
                  Classes on {selectedDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </h3>
                <div className="space-y-4">
                  {getSessionsForDate(selectedDate).map(session => (
                    <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-semibold">{session.class?.name}</h4>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {session.start_time} - {session.end_time}
                          </span>
                          <span className="flex items-center">
                            <Users className="w-4 h-4 mr-1" />
                            {session.max_capacity - session.current_enrollment} spots left
                          </span>
                          <span className="font-semibold text-primary-600">
                            ${session.class?.price}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => addToCart(session)}
                        className="btn btn-primary text-sm"
                        disabled={session.current_enrollment >= session.max_capacity}
                      >
                        {session.current_enrollment >= session.max_capacity ? 'Full' : 'Add to Cart'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
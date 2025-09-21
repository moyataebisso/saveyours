'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, CheckCircle, AlertCircle } from 'lucide-react';
import { supabaseHelpers } from '@/lib/supabase';
import type { Enrollment } from '@/types';

export default function UserDashboard() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [searchEmail, setSearchEmail] = useState('');

  const loadEnrollments = async (userEmail: string) => {
    setLoading(true);
    const { data } = await supabaseHelpers.getUserEnrollments(userEmail);
    setEnrollments(data || []);
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchEmail) {
      setEmail(searchEmail);
      loadEnrollments(searchEmail);
      // Save email for future visits
      localStorage.setItem('dashboardEmail', searchEmail);
    }
  };

  useEffect(() => {
    // Check if email was saved from previous visit
    const savedEmail = localStorage.getItem('dashboardEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setSearchEmail(savedEmail);
      loadEnrollments(savedEmail);
    } else {
      setLoading(false);
    }
  }, []);

  const upcomingClasses = enrollments.filter(e => 
    e.session && new Date(e.session.date) >= new Date()
  );

  const completedClasses = enrollments.filter(e => 
    e.status === 'completed'
  );

  if (!email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-md p-8">
            <h1 className="text-2xl font-bold text-center mb-6">View Your Classes</h1>
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter your email to view your enrollments
                </label>
                <input
                  type="email"
                  required
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="your@email.com"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700"
              >
                View My Classes
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here are your enrolled classes.</p>
        </div>

        {enrollments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Classes Found</h2>
            <p className="text-gray-600">You have not enrolled in any classes yet.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Upcoming Classes */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Upcoming Classes</h2>
              {upcomingClasses.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                  No upcoming classes
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingClasses.map(enrollment => (
                    <div key={enrollment.id} className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="font-semibold text-lg mb-2">
                        {enrollment.session?.class?.name}
                      </h3>
                      
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          {enrollment.session?.date && new Date(enrollment.session.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          {enrollment.session?.start_time} - {enrollment.session?.end_time}
                        </div>
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-2" />
                          Minneapolis, MN
                        </div>
                      </div>

                      {!enrollment.online_course_completed && (
                        <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                          <p className="text-sm text-yellow-800">
                            <strong>Action Required:</strong> Complete online course before attending
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Completed Classes */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Completed Classes</h2>
              {completedClasses.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                  No completed classes yet
                </div>
              ) : (
                <div className="space-y-4">
                  {completedClasses.map(enrollment => (
                    <div key={enrollment.id} className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg mb-2">
                            {enrollment.session?.class?.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Completed: {enrollment.completed_at && 
                              new Date(enrollment.completed_at).toLocaleDateString()
                            }
                          </p>
                        </div>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      
                      {enrollment.certification_expires && (
                        <div className="mt-3 p-2 bg-green-50 rounded">
                          <p className="text-sm text-green-800">
                            Certification valid until:{' '}
                            {new Date(enrollment.certification_expires).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              localStorage.removeItem('dashboardEmail');
              window.location.reload();
            }}
            className="text-gray-600 hover:text-gray-800 text-sm"
          >
            View different email
          </button>
        </div>
      </div>
    </div>
  );
}
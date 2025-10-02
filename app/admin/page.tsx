'use client';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Users, DollarSign, MessageSquare, Plus, Edit, Trash2, CheckCircle, X } from 'lucide-react';
import { supabaseHelpers } from '@/lib/supabase';
import { toast } from '@/components/ui/Toaster';
import type { Enrollment, ClassSession, Inquiry, Class } from '@/types';

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'enrollments' | 'inquiries'>('overview');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSession, setShowAddSession] = useState(false);
  const [cancellingSession, setCancellingSession] = useState<string | null>(null);

  // Hardcoded password
  const ADMIN_PASSWORD = 'SaveYours2024!';
  const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = () => {
    const isAdmin = localStorage.getItem('adminAuthenticated');
    const authTime = localStorage.getItem('adminAuthTime');
    
    if (isAdmin === 'true' && authTime) {
      // Check if session has expired
      const sessionAge = Date.now() - parseInt(authTime);
      
      if (sessionAge > SESSION_TIMEOUT) {
        // Session expired
        console.log('Admin session expired');
        localStorage.removeItem('adminAuthenticated');
        localStorage.removeItem('adminAuthTime');
        setIsAuthenticated(false);
        toast.info('Session expired. Please login again.');
      } else {
        // Session still valid
        const remainingTime = SESSION_TIMEOUT - sessionAge;
        const remainingMinutes = Math.floor(remainingTime / 60000);
        console.log(`Admin session valid. ${remainingMinutes} minutes remaining.`);
        setIsAuthenticated(true);
        loadData();
      }
    } else {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === ADMIN_PASSWORD) {
      // Set authentication with timestamp
      localStorage.setItem('adminAuthenticated', 'true');
      localStorage.setItem('adminAuthTime', Date.now().toString());
      setIsAuthenticated(true);
      loadData();
      toast.success('Login successful - session expires in 2 hours');
    } else {
      toast.error('Invalid password');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuthenticated');
    localStorage.removeItem('adminAuthTime');
    setIsAuthenticated(false);
    router.push('/');
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Get ALL sessions for admin view
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('class_sessions')
        .select('*, class:classes(*)')
        .order('date', { ascending: true });

      if (sessionsError) {
        console.error('Error loading sessions:', sessionsError);
        toast.error('Failed to load sessions');
      } else {
        console.log('Loaded sessions with IDs:', sessionsData?.map(s => ({ 
          id: s.id, 
          date: s.date, 
          status: s.status 
        })));
        setSessions(sessionsData || []);
      }

      // Load other data
      const [enrollmentsData, inquiriesData, classesData] = await Promise.all([
        supabaseHelpers.getAllEnrollments(),
        supabaseHelpers.getInquiries(),
        supabase.from('classes').select('*')
      ]);

      setEnrollments(enrollmentsData.data || []);
      setInquiries(inquiriesData.data || []);
      setClasses(classesData.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const markEnrollmentComplete = async (enrollmentId: string) => {
    const { error } = await supabase
      .from('enrollments')
      .update({ 
        status: 'completed',
        online_course_completed: true,
        completed_at: new Date().toISOString()
      })
      .eq('id', enrollmentId);

    if (!error) {
      toast.success('Enrollment marked as complete');
      loadData();
    } else {
      toast.error('Failed to update enrollment');
    }
  };

  // SIMPLIFIED CANCEL FUNCTION - Direct approach without corruption handling
  const cancelSession = async (sessionId: string) => {
    console.log('=== CANCEL SESSION ===');
    console.log('Session ID to cancel:', sessionId);
    
    setCancellingSession(sessionId);
    
    try {
      // Simple, direct update - no fancy error handling
      const { data, error } = await supabase
        .from('class_sessions')
        .update({ status: 'cancelled' })
        .eq('id', sessionId)
        .select();
      
      console.log('Update result - Data:', data, 'Error:', error);
      
      if (error) {
        console.error('Supabase error:', error);
        
        // Check if it's a permission issue
        if (error.message?.includes('permission') || error.message?.includes('RLS')) {
          toast.error('Permission denied. Check Row Level Security policies.');
        } else {
          toast.error(`Database error: ${error.message}`);
        }
        return;
      }
      
      if (data && data.length > 0) {
        console.log('Session cancelled successfully');
        toast.success('Session cancelled successfully');
        
        // Update local state immediately so UI reflects the change
        setSessions(prevSessions => 
          prevSessions.map(session => 
            session.id === sessionId
              ? { ...session, status: 'cancelled' }
              : session
          )
        );
        
        // Also cancel related enrollments (don't wait for this)
        const cancelEnrollments = async () => {
          try {
            await supabase
              .from('enrollments')
              .update({ status: 'cancelled' })
              .eq('session_id', sessionId);
            console.log('Enrollments cancelled');
          } catch (err) {
            console.error('Error cancelling enrollments:', err);
          }
        };
        cancelEnrollments();
        
      } else {
        console.log('No data returned - session may not exist');
        toast.error('Session not found in database');
      }
      
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('Unexpected error. Check browser console for details.');
    } finally {
      setCancellingSession(null);
    }
  };

  const updateInquiryStatus = async (inquiryId: string, status: 'contacted' | 'resolved') => {
    const { error } = await supabaseHelpers.updateInquiryStatus(inquiryId, status);
    if (!error) {
      toast.success('Inquiry updated');
      loadData();
    } else {
      toast.error('Failed to update inquiry');
    }
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700"
            >
              Login
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-4 text-center">
            Session will expire after 2 hours of login
          </p>
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

  // Calculate stats - only count scheduled sessions as upcoming
  const totalRevenue = enrollments
    .filter(e => e.payment_status === 'paid')
    .reduce((sum, e) => sum + (e.amount_paid || 0), 0);
  const upcomingSessions = sessions.filter(s => {
    const sessionDate = new Date(s.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sessionDate >= today && s.status === 'scheduled';
  }).length;
  const totalEnrollments = enrollments.length;
  const newInquiries = inquiries.filter(i => i.status === 'new').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-900"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500">Total Revenue</span>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold">${totalRevenue}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500">Enrollments</span>
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{totalEnrollments}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500">Upcoming Sessions</span>
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold">{upcomingSessions}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500">New Inquiries</span>
              <MessageSquare className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold">{newInquiries}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b flex">
            {(['overview', 'sessions', 'enrollments', 'inquiries'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 capitalize ${
                  activeTab === tab 
                    ? 'border-b-2 border-primary-600 text-primary-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
                <div className="space-y-4">
                  {enrollments.slice(0, 5).map(enrollment => (
                    <div key={enrollment.id} className="flex justify-between items-center py-2 border-b">
                      <div>
                        <p className="font-medium">{enrollment.guest_name || enrollment.user?.full_name}</p>
                        <p className="text-sm text-gray-600">{enrollment.session?.class?.name}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        enrollment.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {enrollment.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'sessions' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Class Sessions</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddSession(true)}
                      className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Session
                    </button>
                    <button
                      onClick={() => loadData()}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      title="Refresh data from database"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Class</th>
                        <th className="px-4 py-2 text-left">Time</th>
                        <th className="px-4 py-2 text-left">Enrolled</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions
                        .filter(session => session.status !== 'cancelled') // Hide cancelled sessions
                        .map(session => (
                        <tr key={session.id} className="border-b">
                          <td className="px-4 py-2">
                            {new Date(session.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2">{session.class?.name}</td>
                          <td className="px-4 py-2">
                            {session.start_time} - {session.end_time}
                          </td>
                          <td className="px-4 py-2">
                            {session.current_enrollment}/{session.max_capacity}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              session.status === 'scheduled' 
                                ? 'bg-green-100 text-green-800'
                                : session.status === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : session.status === 'full'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {session.status}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {session.status === 'scheduled' ? (
                              <button
                                onClick={() => cancelSession(session.id)}
                                disabled={cancellingSession === session.id}
                                className={`text-red-600 hover:text-red-800 ${
                                  cancellingSession === session.id ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                              >
                                {cancellingSession === session.id ? 'Cancelling...' : 'Cancel'}
                              </button>
                            ) : session.status === 'cancelled' ? (
                              <span className="text-gray-400">Cancelled</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'enrollments' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Enrollments</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Student</th>
                        <th className="px-4 py-2 text-left">Email</th>
                        <th className="px-4 py-2 text-left">Class</th>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map(enrollment => (
                        <tr key={enrollment.id} className="border-b">
                          <td className="px-4 py-2">
                            {enrollment.guest_name || enrollment.user?.full_name}
                          </td>
                          <td className="px-4 py-2">
                            {enrollment.guest_email || enrollment.user?.email}
                          </td>
                          <td className="px-4 py-2">
                            {enrollment.session?.class?.name}
                          </td>
                          <td className="px-4 py-2">
                            {enrollment.session?.date && new Date(enrollment.session.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              enrollment.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : enrollment.status === 'confirmed'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {enrollment.status}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {enrollment.status !== 'completed' && (
                              <button
                                onClick={() => markEnrollmentComplete(enrollment.id)}
                                className="text-green-600 hover:text-green-800"
                              >
                                Mark Complete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'inquiries' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Contact Inquiries</h2>
                <div className="space-y-4">
                  {inquiries.map(inquiry => (
                    <div key={inquiry.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">{inquiry.name}</p>
                          <p className="text-sm text-gray-600">{inquiry.email}</p>
                          {inquiry.phone && (
                            <p className="text-sm text-gray-600">{inquiry.phone}</p>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${
                          inquiry.status === 'new'
                            ? 'bg-red-100 text-red-800'
                            : inquiry.status === 'contacted'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {inquiry.status}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-2">{inquiry.message}</p>
                      {inquiry.service_type && (
                        <p className="text-sm text-gray-600 mb-2">
                          Service: {inquiry.service_type}
                        </p>
                      )}
                      <div className="flex gap-2">
                        {inquiry.status === 'new' && (
                          <button
                            onClick={() => updateInquiryStatus(inquiry.id, 'contacted')}
                            className="text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
                          >
                            Mark Contacted
                          </button>
                        )}
                        {inquiry.status !== 'resolved' && (
                          <button
                            onClick={() => updateInquiryStatus(inquiry.id, 'resolved')}
                            className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                          >
                            Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Session Modal */}
      {showAddSession && <AddSessionModal classes={classes} onClose={() => {
        setShowAddSession(false);
        loadData();
      }} />}
    </div>
  );
}

// Add Session Modal Component
function AddSessionModal({ classes, onClose }: { classes: Class[], onClose: () => void }) {
  const [formData, setFormData] = useState({
    class_id: '',
    date: '',
    start_time: '',
    end_time: '',
    location: '5450 W 41st St, Minneapolis, MN 55416',
    max_capacity: 12
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabaseHelpers.createClassSession(formData);
    if (!error) {
      toast.success('Session created successfully');
      onClose();
    } else {
      toast.error('Failed to create session');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Add New Session</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Class</label>
            <select
              required
              value={formData.class_id}
              onChange={(e) => setFormData({...formData, class_id: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select a class</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Time</label>
              <input
                type="time"
                required
                value={formData.start_time}
                onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Time</label>
              <input
                type="time"
                required
                value={formData.end_time}
                onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700"
            >
              Create Session
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
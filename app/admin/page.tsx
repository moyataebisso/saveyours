'use client';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Users, DollarSign, MessageSquare, Plus, Edit, Trash2, CheckCircle, X, Clock, Phone, Mail, Save, Link } from 'lucide-react';
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
  const [editingSession, setEditingSession] = useState<ClassSession | null>(null);
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
      const sessionAge = Date.now() - parseInt(authTime);
      
      if (sessionAge > SESSION_TIMEOUT) {
        console.log('Admin session expired');
        localStorage.removeItem('adminAuthenticated');
        localStorage.removeItem('adminAuthTime');
        setIsAuthenticated(false);
        toast.info('Session expired. Please login again.');
      } else {
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
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('status')
      .eq('id', enrollmentId)
      .single();

    if (enrollment?.status === 'cancelled') {
      toast.error('Cannot complete a cancelled enrollment');
      return;
    }

    const { error } = await supabase
      .from('enrollments')
      .update({ 
        status: 'completed',
        online_course_completed: true
      })
      .eq('id', enrollmentId);

    if (!error) {
      toast.success('Enrollment marked as complete');
      loadData();
    } else {
      toast.error('Failed to update enrollment');
    }
  };

  const restoreEnrollment = async (enrollmentId: string, sessionId: string) => {
    console.log('=== RESTORE ENROLLMENT ===');
    console.log('Enrollment ID:', enrollmentId);
    console.log('Session ID:', sessionId);
    
    const { data, error } = await supabaseHelpers.restoreEnrollment(enrollmentId, sessionId);
    
    if (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to restore enrollment');
    } else {
      console.log('Enrollment restored successfully');
      toast.success('Enrollment restored successfully');
      loadData();
    }
  };

  const cancelSession = async (sessionId: string) => {
    console.log('=== CANCEL SESSION ===');
    console.log('Session ID to cancel:', sessionId);
    
    setCancellingSession(sessionId);
    
    try {
      const { data, error } = await supabase
        .from('class_sessions')
        .update({ status: 'cancelled' })
        .eq('id', sessionId)
        .select();
      
      console.log('Update result - Data:', data, 'Error:', error);
      
      if (error) {
        console.error('Supabase error:', error);
        
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
        
        setSessions(prevSessions => 
          prevSessions.map(session => 
            session.id === sessionId
              ? { ...session, status: 'cancelled' }
              : session
          )
        );
        
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
    console.log('=== UPDATE INQUIRY STATUS ===');
    console.log('Inquiry ID:', inquiryId);
    console.log('New Status:', status);
    
    setInquiries(prevInquiries => 
      prevInquiries.map(inq => 
        inq.id === inquiryId 
          ? { ...inq, status } 
          : inq
      )
    );
    
    const { error, data } = await supabaseHelpers.updateInquiryStatus(inquiryId, status);
    
    console.log('Update result - Error:', error, 'Data:', data);
    
    if (!error) {
      toast.success(`Inquiry marked as ${status}`);
      await loadData();
    } else {
      toast.error('Failed to update inquiry');
      console.error('Error updating inquiry:', error);
      await loadData();
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

  // Calculate stats
  const totalRevenue = enrollments
    .filter(e => e.payment_status === 'paid' && e.status !== 'cancelled')
    .reduce((sum, e) => sum + (e.amount_paid || 0), 0);
  const upcomingSessions = sessions.filter(s => {
    const sessionDate = new Date(s.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sessionDate >= today && s.status === 'scheduled';
  }).length;
  const totalEnrollments = enrollments.filter(e => e.status !== 'cancelled').length;
  const newInquiries = inquiries.filter(i => i.status === 'new').length;

  // Organize inquiries by status
  const newInquiriesList = inquiries.filter(i => i.status === 'new');
  const contactedInquiries = inquiries.filter(i => i.status === 'contacted');
  const resolvedInquiries = inquiries.filter(i => i.status === 'resolved');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/vouchers')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Link className="w-4 h-4" />
              Manage Vouchers
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
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
                  {enrollments
                    .filter(enrollment => enrollment.status !== 'cancelled')
                    .slice(0, 5)
                    .map(enrollment => (
                    <div key={enrollment.id} className="flex justify-between items-center py-2 border-b">
                      <div>
                        <p className="font-medium">{enrollment.guest_name || enrollment.user?.full_name}</p>
                        <p className="text-sm text-gray-600">{enrollment.session?.class?.name}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        enrollment.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : enrollment.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {enrollment.status}
                      </span>
                    </div>
                  ))}
                  {enrollments.filter(e => e.status !== 'cancelled').length === 0 && (
                    <p className="text-gray-500 italic">No active enrollments</p>
                  )}
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
                        .filter(session => session.status !== 'cancelled')
                        .map(session => (
                        <tr key={session.id} className="border-b">
                          <td className="px-4 py-2">
                            {new Date(session.date + 'T00:00:00').toLocaleDateString()}
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
                            <div className="flex gap-2">
                              {session.status === 'scheduled' && (
                                <>
                                  <button
                                    onClick={() => setEditingSession(session)}
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Edit session"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => cancelSession(session.id)}
                                    disabled={cancellingSession === session.id}
                                    className={`text-red-600 hover:text-red-800 ${
                                      cancellingSession === session.id ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                    title="Cancel session"
                                  >
                                    {cancellingSession === session.id ? '...' : <Trash2 className="w-4 h-4" />}
                                  </button>
                                </>
                              )}
                            </div>
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
                      {enrollments
                        .filter(enrollment => enrollment.status !== 'cancelled')
                        .map(enrollment => (
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
                            {enrollment.session?.date && new Date(enrollment.session.date + 'T00:00:00').toLocaleDateString()}
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
                            {enrollment.status === 'confirmed' || enrollment.status === 'pending' ? (
                              <button
                                onClick={() => markEnrollmentComplete(enrollment.id)}
                                className="text-green-600 hover:text-green-800"
                              >
                                Mark Complete
                              </button>
                            ) : enrollment.status === 'completed' ? (
                              <span className="text-green-600">✓ Completed</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cancelled Enrollments - Collapsible Section with Restore */}
                {enrollments.filter(e => e.status === 'cancelled').length > 0 && (
                  <details className="mt-6 border rounded-lg">
                    <summary className="px-4 py-3 cursor-pointer bg-gray-50 hover:bg-gray-100 font-medium text-gray-700">
                      🗑️ Cancelled Enrollments ({enrollments.filter(e => e.status === 'cancelled').length})
                    </summary>
                    <div className="p-4">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left">Student</th>
                            <th className="px-4 py-2 text-left">Email</th>
                            <th className="px-4 py-2 text-left">Class</th>
                            <th className="px-4 py-2 text-left">Date</th>
                            <th className="px-4 py-2 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enrollments
                            .filter(enrollment => enrollment.status === 'cancelled')
                            .map(enrollment => (
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
                                {enrollment.session?.date && new Date(enrollment.session.date + 'T00:00:00').toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => restoreEnrollment(enrollment.id, enrollment.session_id)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                  title="Restore this enrollment"
                                >
                                  🔄 Restore
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            )}

            {activeTab === 'inquiries' && (
              <div>
                <h2 className="text-xl font-semibold mb-6">Contact Inquiries</h2>
                
                {/* NEW INQUIRIES SECTION */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-red-600" />
                    <h3 className="text-lg font-semibold text-red-600">
                      New Inquiries ({newInquiriesList.length})
                    </h3>
                  </div>
                  {newInquiriesList.length === 0 ? (
                    <p className="text-gray-500 italic">No new inquiries</p>
                  ) : (
                    <div className="space-y-4">
                      {newInquiriesList.map(inquiry => (
                        <InquiryCard 
                          key={inquiry.id} 
                          inquiry={inquiry} 
                          onUpdate={updateInquiryStatus}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* CONTACTED INQUIRIES SECTION */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <h3 className="text-lg font-semibold text-yellow-600">
                      Contacted ({contactedInquiries.length})
                    </h3>
                  </div>
                  {contactedInquiries.length === 0 ? (
                    <p className="text-gray-500 italic">No contacted inquiries</p>
                  ) : (
                    <div className="space-y-4">
                      {contactedInquiries.map(inquiry => (
                        <InquiryCard 
                          key={inquiry.id} 
                          inquiry={inquiry} 
                          onUpdate={updateInquiryStatus}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* RESOLVED INQUIRIES SECTION */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-green-600">
                      Resolved ({resolvedInquiries.length})
                    </h3>
                  </div>
                  {resolvedInquiries.length === 0 ? (
                    <p className="text-gray-500 italic">No resolved inquiries</p>
                  ) : (
                    <div className="space-y-4">
                      {resolvedInquiries.map(inquiry => (
                        <InquiryCard 
                          key={inquiry.id} 
                          inquiry={inquiry} 
                          onUpdate={updateInquiryStatus}
                        />
                      ))}
                    </div>
                  )}
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

      {/* Edit Session Modal */}
      {editingSession && <EditSessionModal session={editingSession} classes={classes} onClose={() => {
        setEditingSession(null);
        loadData();
      }} />}
    </div>
  );
}

// Inquiry Card Component
function InquiryCard({ 
  inquiry, 
  onUpdate 
}: { 
  inquiry: Inquiry; 
  onUpdate: (id: string, status: 'contacted' | 'resolved') => void;
}) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <p className="font-semibold text-lg">{inquiry.name}</p>
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex items-center text-sm text-gray-600">
              <Mail className="w-4 h-4 mr-2" />
              <a href={`mailto:${inquiry.email}`} className="hover:text-primary-600">
                {inquiry.email}
              </a>
            </div>
            {inquiry.phone && (
              <div className="flex items-center text-sm text-gray-600">
                <Phone className="w-4 h-4 mr-2" />
                <a href={`tel:${inquiry.phone}`} className="hover:text-primary-600">
                  {inquiry.phone}
                </a>
              </div>
            )}
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          inquiry.status === 'new'
            ? 'bg-red-100 text-red-800'
            : inquiry.status === 'contacted'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-green-100 text-green-800'
        }`}>
          {inquiry.status.toUpperCase()}
        </span>
      </div>
      
      <div className="bg-gray-50 p-3 rounded mb-3">
        <p className="text-gray-700 text-sm">{inquiry.message}</p>
      </div>
      
      {inquiry.service_type && (
        <p className="text-sm text-gray-600 mb-3">
          <span className="font-medium">Service Requested:</span> {inquiry.service_type}
        </p>
      )}
      
      <div className="flex gap-2">
        {inquiry.status === 'new' && (
          <button
            onClick={() => onUpdate(inquiry.id, 'contacted')}
            className="text-sm bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Mark as Contacted
          </button>
        )}
        {inquiry.status !== 'resolved' && (
          <button
            onClick={() => onUpdate(inquiry.id, 'resolved')}
            className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Mark as Resolved
          </button>
        )}
        {inquiry.status === 'resolved' && (
          <span className="text-sm text-green-600 font-medium">✓ Resolved</span>
        )}
      </div>
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
    console.log('📅 Submitting session with date:', formData.date);
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

// Edit Session Modal Component
function EditSessionModal({ session, classes, onClose }: { session: ClassSession, classes: Class[], onClose: () => void }) {
  const [formData, setFormData] = useState({
    class_id: session.class_id,
    date: session.date,
    start_time: session.start_time,
    end_time: session.end_time,
    location: session.location || '5450 W 41st St, Minneapolis, MN 55416',
    max_capacity: session.max_capacity
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📅 Updating session with date:', formData.date);
    const { error } = await supabaseHelpers.updateClassSession(session.id, formData);
    if (!error) {
      toast.success('Session updated successfully');
      onClose();
    } else {
      toast.error('Failed to update session');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Edit Session</h2>
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

          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Max Capacity</label>
            <input
              type="number"
              required
              min="1"
              max="50"
              value={formData.max_capacity}
              onChange={(e) => setFormData({...formData, max_capacity: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
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
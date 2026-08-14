'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Users, MessageSquare, Plus, Edit, Trash2, CheckCircle, X, Clock, Phone, Mail, Save, Link } from 'lucide-react';
import { toast } from '@/components/ui/Toaster';
import type { Enrollment, ClassSession, Inquiry, Class } from '@/types';

interface OverviewStats {
  totalEnrollments: number;
  totalRevenue: number;
  activeClassRevenue: number;
  upcomingSessions: number;
  newInquiries: number;
}

// Mirrors the formatTime helper in app/api/enrollment/create/route.ts.
// Input is the raw class_sessions.start_time value ("HH:MM" or "HH:MM:SS");
// callers must guard against null/empty before invoking (render em dash instead).
function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loginEmail, setLoginEmail] = useState('info@saveyours.net');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'enrollments' | 'inquiries'>('overview');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  // If the overview fetch fails we render a full-screen error state instead
  // of the dashboard — Meea must never see $0 revenue simply because the API
  // 500'd. This state is what gates that behavior.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAddSession, setShowAddSession] = useState(false);
  const [editingSession, setEditingSession] = useState<ClassSession | null>(null);
  const [cancellingSession, setCancellingSession] = useState<string | null>(null);
  const [showReconcile, setShowReconcile] = useState(false);
  const [reconcileData, setReconcileData] = useState<{
    ok: { paymentId: string; amount: number; name: string; email: string }[];
    incomplete: { paymentId: string; amount: number; enrollmentId: string; name: string | null; email: string | null }[];
    missing: { paymentId: string; amount: number; created: number; name: string | null; email: string | null; metadata: Record<string, string> }[];
  } | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [creatingEnrollment, setCreatingEnrollment] = useState<string | null>(null);
  const [sendEmailsOnReconcile, setSendEmailsOnReconcile] = useState(true);
  const [reconcileNotifications, setReconcileNotifications] = useState<Array<{
    sessionId: string;
    className?: string;
    confirmationSent: boolean;
    voucherAssigned: boolean;
    voucherEmailSent: boolean;
    warning?: string;
  }>>([]);

  // Session lives in an HttpOnly cookie set by /api/admin/login. This flag is
  // a non-authoritative UI hint only; the real auth check is /api/admin/session,
  // which we call on mount to decide whether to render the dashboard or the
  // login form.
  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    setCheckingSession(true);
    try {
      const res = await fetch('/api/admin/session', { cache: 'no-store' });
      if (res.ok) {
        localStorage.setItem('adminAuthenticated', 'true');
        setIsAuthenticated(true);
        loadData();
      } else {
        localStorage.removeItem('adminAuthenticated');
        localStorage.removeItem('adminAuthTime');
        setIsAuthenticated(false);
        setLoading(false);
      }
    } catch {
      setIsAuthenticated(false);
      setLoading(false);
    } finally {
      setCheckingSession(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password }),
      });
      if (res.ok) {
        localStorage.setItem('adminAuthenticated', 'true');
        setPassword('');
        setIsAuthenticated(true);
        loadData();
        toast.success('Login successful');
      } else {
        const data = await res.json().catch(() => ({}));
        setLoginError(data?.error || 'Invalid credentials');
      }
    } catch {
      setLoginError('Login failed. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // Server logout is best-effort; the important part is clearing the client hint.
    }
    localStorage.removeItem('adminAuthenticated');
    localStorage.removeItem('adminAuthTime');
    setIsAuthenticated(false);
    router.push('/');
  };

  // Single-shot dashboard load. /api/admin/overview returns lists (capped)
  // plus SQL-computed stats. All post-mutation reloads also hit this route
  // — one round trip keeps the four tabs and the header cards consistent.
  //
  // On ANY failure (5xx, network, malformed body), state is wiped and
  // loadError is set. The render path then blocks with an error screen
  // instead of showing zeros/empty tables. Do not soften this — silent
  // partial data on a payments dashboard is worse than a loud failure.
  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/admin/overview', { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('adminAuthenticated');
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
        setStats(null);
        setSessions([]);
        setEnrollments([]);
        setInquiries([]);
        setClasses([]);
        setLoadError(`Dashboard failed to load (HTTP ${res.status}). Do not trust any numbers shown elsewhere until this reloads.`);
        toast.error('Failed to load dashboard data');
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!data || typeof data !== 'object' || !data.stats) {
        setStats(null);
        setSessions([]);
        setEnrollments([]);
        setInquiries([]);
        setClasses([]);
        setLoadError('Dashboard returned unexpected data. Retry, or contact support.');
        toast.error('Failed to load dashboard data');
        setLoading(false);
        return;
      }
      setSessions(data.sessions || []);
      setEnrollments(data.enrollments || []);
      setInquiries(data.inquiries || []);
      setClasses(data.classes || []);
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading data:', error);
      setStats(null);
      setSessions([]);
      setEnrollments([]);
      setInquiries([]);
      setClasses([]);
      setLoadError('Dashboard failed to load (network error). Check your connection and retry.');
      toast.error('Failed to load dashboard data');
    }
    setLoading(false);
  };

  const markEnrollmentComplete = async (enrollmentId: string) => {
    try {
      const res = await fetch(`/api/admin/enrollments/${enrollmentId}/complete`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || 'Failed to update enrollment');
        return;
      }
      toast.success('Enrollment marked as complete');
      loadData();
    } catch (err) {
      console.error('markEnrollmentComplete threw:', err);
      toast.error('Failed to update enrollment');
    }
  };

  const restoreEnrollment = async (enrollmentId: string, sessionId: string) => {
    try {
      const res = await fetch(`/api/admin/enrollments/${enrollmentId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || 'Failed to restore enrollment');
        return;
      }
      toast.success('Enrollment restored successfully');
      loadData();
    } catch (err) {
      console.error('restoreEnrollment threw:', err);
      toast.error('Failed to restore enrollment');
    }
  };

  const removeEnrollment = async (enrollmentId: string, sessionId: string, studentName: string) => {
    if (!confirm(`Remove ${studentName} from this class? This will free up their spot.`)) return;

    try {
      const res = await fetch(`/api/admin/enrollments/${enrollmentId}/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || 'Failed to remove enrollment');
        return;
      }
      toast.success('Student removed and spot freed up');
      loadData();
    } catch (err) {
      console.error('removeEnrollment threw:', err);
      toast.error('Failed to remove enrollment');
    }
  };

  const cancelSession = async (sessionId: string) => {
    setCancellingSession(sessionId);

    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/cancel`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data?.error || 'Failed to cancel session');
        return;
      }

      toast.success('Session cancelled successfully');

      // Optimistic local update — the server-side cascade already ran, but
      // we refresh below via loadData to pull the canonical state.
      setSessions(prevSessions =>
        prevSessions.map(session =>
          session.id === sessionId
            ? { ...session, status: 'cancelled' }
            : session
        )
      );

      if (data.cascadeError) {
        console.error('[CANCEL_SESSION] Enrollment cascade error (non-fatal):', data.cascadeError);
      }

      loadData();
    } catch (err) {
      console.error('cancelSession threw:', err);
      toast.error('Unexpected error. Check browser console for details.');
    } finally {
      setCancellingSession(null);
    }
  };

  const updateInquiryStatus = async (inquiryId: string, status: 'contacted' | 'resolved') => {
    setInquiries(prevInquiries =>
      prevInquiries.map(inq =>
        inq.id === inquiryId
          ? { ...inq, status }
          : inq
      )
    );

    try {
      const res = await fetch(`/api/admin/inquiries/${inquiryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || 'Failed to update inquiry');
      } else {
        toast.success(`Inquiry marked as ${status}`);
      }
    } catch (err) {
      console.error('updateInquiryStatus threw:', err);
      toast.error('Failed to update inquiry');
    }
    await loadData();
  };

  // Loading state while probing the session cookie on mount.
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-3"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4"
              autoFocus
              required
            />
            {loginError && (
              <p className="text-sm text-red-600 mb-3">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loggingIn ? 'Signing in…' : 'Login'}
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-4 text-center">
            Session expires after 2 hours
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

  // Full-screen error state on load failure. Replaces the dashboard
  // entirely — no stats cards, no tabs, no tables. Never render zeros
  // that look like real numbers when the data is actually missing.
  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50">
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
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto bg-white border-l-4 border-red-500 rounded-lg shadow p-8">
            <h2 className="text-xl font-bold text-red-700 mb-3">Dashboard unavailable</h2>
            <p className="text-gray-700 mb-4">{loadError}</p>
            <p className="text-sm text-gray-600 mb-6">
              Nothing on this page is being displayed because the data could not be loaded.
              This is intentional — showing partial or zero values on a payments dashboard
              would be misleading.
            </p>
            <button
              onClick={loadData}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Stats come from /api/admin/overview — SQL-computed against the full
  // tables, so they're accurate even though the enrollments/inquiries lists
  // are capped for display. Fall back to zeros before the first load lands.
  const totalEnrollments = stats?.totalEnrollments ?? 0;
  const totalRevenue = stats?.totalRevenue ?? 0;
  const activeClassRevenue = stats?.activeClassRevenue ?? 0;
  const upcomingSessions = stats?.upcomingSessions ?? 0;
  const newInquiries = stats?.newInquiries ?? 0;

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
              onClick={async () => {
                setShowReconcile(true);
                setReconcileLoading(true);
                setReconcileNotifications([]);
                try {
                  const res = await fetch('/api/admin/reconcile');
                  const data = await res.json();
                  setReconcileData(data);
                } catch {
                  toast.error('Failed to run reconciliation');
                } finally {
                  setReconcileLoading(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Reconcile
            </button>
            <button
              onClick={() => router.push('/admin/vouchers')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Link className="w-4 h-4" />
              Manage Vouchers
            </button>
            <button
              onClick={() => router.push('/admin/change-requests')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <MessageSquare className="w-4 h-4" />
              Change Requests
            </button>
            <button
              onClick={() => setShowChangePassword(true)}
              className="text-gray-600 hover:text-gray-900"
            >
              Change Password
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
              <span className="text-gray-500">Revenue</span>
              <span className="text-sm text-gray-500">All-time: ${totalRevenue.toLocaleString()}</span>
            </div>
            <p className="text-2xl font-bold">${activeClassRevenue.toLocaleString()}</p>
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
                    .filter(enrollment => enrollment.payment_status === 'paid')
                    .slice(0, 5)
                    .map(enrollment => (
                    <div key={enrollment.id} className="flex justify-between items-center py-2 border-b">
                      <div>
                        <p className="font-medium">{enrollment.guest_name || enrollment.user?.full_name || 'Unknown Student'}</p>
                        <p className="text-sm text-gray-600">
                          {enrollment.guest_email || enrollment.user?.email || ''}
                          {enrollment.session?.class?.name ? ` — ${enrollment.session.class.name}` : ''}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        enrollment.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : enrollment.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : enrollment.status === 'confirmed'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {enrollment.status}
                      </span>
                    </div>
                  ))}
                  {enrollments.filter(e => e.payment_status === 'paid').length === 0 && (
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
                              {session.status !== 'cancelled' && (
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
                        <th className="px-4 py-2 text-left">Time</th>
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
                            {enrollment.guest_name || enrollment.user?.full_name || <span className="text-gray-400 italic">Unknown</span>}
                          </td>
                          <td className="px-4 py-2">
                            {enrollment.guest_email || enrollment.user?.email || <span className="text-gray-400 italic">No email</span>}
                          </td>
                          <td className="px-4 py-2">
                            {enrollment.session?.class?.name || <span className="text-gray-400 italic">Unknown class</span>}
                          </td>
                          <td className="px-4 py-2">
                            {enrollment.session?.date ? new Date(enrollment.session.date + 'T00:00:00').toLocaleDateString() : <span className="text-gray-400 italic">No date</span>}
                          </td>
                          <td className="px-4 py-2">
                            {enrollment.session?.start_time ? formatTime(enrollment.session.start_time) : <span className="text-gray-400 italic">—</span>}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              enrollment.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : enrollment.status === 'confirmed'
                                ? 'bg-blue-100 text-blue-800'
                                : enrollment.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {enrollment.status}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {enrollment.status === 'confirmed' || enrollment.status === 'pending' ? (
                                <>
                                  <button
                                    onClick={() => markEnrollmentComplete(enrollment.id)}
                                    className="text-green-600 hover:text-green-800"
                                  >
                                    Mark Complete
                                  </button>
                                  <button
                                    onClick={() => removeEnrollment(enrollment.id, enrollment.session_id, enrollment.guest_name || enrollment.user?.full_name || 'this student')}
                                    className="text-red-500 hover:text-red-700"
                                    title="Remove student from class"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : enrollment.status === 'completed' ? (
                                <span className="text-green-600">✓ Completed</span>
                              ) : null}
                            </div>
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
                            <th className="px-4 py-2 text-left">Time</th>
                            <th className="px-4 py-2 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enrollments
                            .filter(enrollment => enrollment.status === 'cancelled')
                            .map(enrollment => (
                            <tr key={enrollment.id} className="border-b">
                              <td className="px-4 py-2">
                                {enrollment.guest_name || enrollment.user?.full_name || <span className="text-gray-400 italic">Unknown</span>}
                              </td>
                              <td className="px-4 py-2">
                                {enrollment.guest_email || enrollment.user?.email || <span className="text-gray-400 italic">No email</span>}
                              </td>
                              <td className="px-4 py-2">
                                {enrollment.session?.class?.name || <span className="text-gray-400 italic">Unknown class</span>}
                              </td>
                              <td className="px-4 py-2">
                                {enrollment.session?.date ? new Date(enrollment.session.date + 'T00:00:00').toLocaleDateString() : <span className="text-gray-400 italic">No date</span>}
                              </td>
                              <td className="px-4 py-2">
                                {enrollment.session?.start_time ? formatTime(enrollment.session.start_time) : <span className="text-gray-400 italic">—</span>}
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

      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
          onSuccess={async () => {
            setShowChangePassword(false);
            toast.success('Password changed. Please log in again.');
            localStorage.removeItem('adminAuthenticated');
            localStorage.removeItem('adminAuthTime');
            setIsAuthenticated(false);
          }}
        />
      )}

      {/* Reconcile Modal */}
      {showReconcile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white rounded-t-xl">
              <h2 className="text-xl font-bold">Stripe Reconciliation</h2>
              <button onClick={() => { setShowReconcile(false); setReconcileData(null); setReconcileNotifications([]); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <label className="flex items-center gap-2 mb-4 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={sendEmailsOnReconcile}
                  onChange={(e) => setSendEmailsOnReconcile(e.target.checked)}
                  className="rounded"
                />
                Also send confirmation + voucher email
              </label>

              {reconcileNotifications.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-blue-800 mb-3">Last create result</h3>
                  <div className="space-y-2">
                    {reconcileNotifications.map((n, idx) => (
                      <div
                        key={idx}
                        className={
                          n.warning
                            ? 'bg-red-50 border border-red-300 rounded p-3 text-sm'
                            : 'bg-white border border-blue-100 rounded p-3 text-sm'
                        }
                      >
                        <p><strong>Session:</strong> {n.className || n.sessionId}</p>
                        <p>Confirmation email: {n.confirmationSent ? '✓ sent' : '✗ not sent'}</p>
                        <p>Voucher assigned: {n.voucherAssigned ? '✓ yes' : '— no'}</p>
                        <p>Voucher email: {n.voucherEmailSent ? '✓ sent' : '— not sent'}</p>
                        {n.warning && (
                          <p className="mt-2 text-red-800 font-semibold">⚠️ {n.warning}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reconcileLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Checking Stripe payments against enrollments...</p>
                </div>
              ) : reconcileData ? (
                <div className="space-y-6">
                  {/* OK Section */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-green-800">OK: {reconcileData.ok.length} payments matched correctly</h3>
                  </div>

                  {/* Incomplete Section */}
                  {reconcileData.incomplete.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h3 className="font-semibold text-yellow-800 mb-3">Incomplete: {reconcileData.incomplete.length} enrollments missing data</h3>
                      <div className="space-y-2">
                        {reconcileData.incomplete.map((item) => (
                          <div key={item.paymentId} className="bg-white rounded p-3 text-sm border border-yellow-100">
                            <p><strong>Payment:</strong> {item.paymentId}</p>
                            <p><strong>Amount:</strong> ${item.amount}</p>
                            <p><strong>Name:</strong> {item.name || <span className="text-red-600">MISSING</span>}</p>
                            <p><strong>Email:</strong> {item.email || <span className="text-red-600">MISSING</span>}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing Section */}
                  {reconcileData.missing.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h3 className="font-semibold text-red-800 mb-3">Missing: {reconcileData.missing.length} payments with no enrollment</h3>
                      <div className="space-y-3">
                        {reconcileData.missing.map((item) => (
                          <div key={item.paymentId} className="bg-white rounded p-3 text-sm border border-red-100">
                            <p><strong>Payment:</strong> {item.paymentId}</p>
                            <p><strong>Amount:</strong> ${item.amount}</p>
                            <p><strong>Date:</strong> {new Date(item.created * 1000).toLocaleDateString()}</p>
                            <p><strong>Name:</strong> {item.name || <span className="text-gray-400">not in metadata</span>}</p>
                            <p><strong>Email:</strong> {item.email || <span className="text-gray-400">not in metadata</span>}</p>
                            {item.metadata.sessionIds && (
                              <p><strong>Sessions:</strong> {item.metadata.sessionIds}</p>
                            )}
                            {item.metadata.className && (
                              <p><strong>Class:</strong> {item.metadata.className}</p>
                            )}
                            <button
                              disabled={creatingEnrollment === item.paymentId}
                              onClick={async () => {
                                setCreatingEnrollment(item.paymentId);
                                try {
                                  const res = await fetch('/api/admin/reconcile', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      paymentIntentId: item.paymentId,
                                      sendEmails: sendEmailsOnReconcile,
                                    })
                                  });
                                  const result = await res.json();
                                  if (Array.isArray(result.notifications)) {
                                    setReconcileNotifications(result.notifications);
                                    result.notifications.forEach((n: { warning?: string }) => {
                                      if (n.warning) toast.error(n.warning);
                                    });
                                  } else {
                                    setReconcileNotifications([]);
                                  }
                                  if (result.created?.length > 0) {
                                    toast.success(`Created ${result.created.length} enrollment(s)`);
                                    // Re-run reconciliation
                                    const refreshRes = await fetch('/api/admin/reconcile');
                                    setReconcileData(await refreshRes.json());
                                    loadData();
                                  } else {
                                    toast.error(result.errors?.join(', ') || result.error || 'Failed to create enrollment');
                                  }
                                } catch {
                                  toast.error('Failed to create enrollment');
                                } finally {
                                  setCreatingEnrollment(null);
                                }
                              }}
                              className="mt-2 px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50"
                            >
                              {creatingEnrollment === item.paymentId ? 'Creating...' : 'Create Enrollment'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {reconcileData.missing.length === 0 && reconcileData.incomplete.length === 0 && (
                    <p className="text-center text-gray-600 py-4">All Stripe payments are accounted for.</p>
                  )}
                </div>
              ) : (
                <p className="text-center text-red-600">Failed to load reconciliation data.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Change Password Modal Component
function ChangePasswordModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 12) {
      setError('New password must be at least 12 characters');
      return;
    }
    if (/saveyours/i.test(newPassword)) {
      setError('New password must not contain "saveyours"');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Failed to change password');
      }
    } catch {
      setError('Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">Change Password</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              At least 12 characters; must not contain &ldquo;saveyours&rdquo;.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : 'Change Password'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
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
    location: '10800 Lyndale Ave S Suite 310, Bloomington, MN 55420',
    max_capacity: 12
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || 'Failed to create session');
        return;
      }
      toast.success('Session created successfully');
      onClose();
    } catch (err) {
      console.error('createClassSession threw:', err);
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

          <div>
            <label className="block text-sm font-medium mb-1">Max Students</label>
            <input
              type="number"
              required
              min={1}
              max={50}
              value={formData.max_capacity}
              onChange={(e) => setFormData({...formData, max_capacity: parseInt(e.target.value) || 12})}
              className="w-full px-3 py-2 border rounded-lg"
            />
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
    location: session.location || '10800 Lyndale Ave S Suite 310, Bloomington, MN 55420',
    max_capacity: session.max_capacity
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If capacity increased on a full session, flip status back to scheduled.
    // Client decides this because it knows the pre-edit state; server just
    // whitelist-applies whatever we send.
    const updates: Partial<import('@/types').SessionData> & { status?: string } = { ...formData };
    if (session.status === 'full' && formData.max_capacity > session.current_enrollment) {
      updates.status = 'scheduled';
    }

    try {
      const res = await fetch(`/api/admin/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || 'Failed to update session');
        return;
      }
      toast.success('Session updated successfully');
      onClose();
    } catch (err) {
      console.error('updateClassSession threw:', err);
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
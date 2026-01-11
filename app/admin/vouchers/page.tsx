'use client';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Link as LinkIcon, CheckCircle, Clock } from 'lucide-react';
import { supabaseHelpers } from '@/lib/supabase';
import { toast } from '@/components/ui/Toaster';
import type { ClassSession, VoucherLink } from '@/types';

export default function VouchersPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [vouchers, setVouchers] = useState<VoucherLink[]>([]);
  const [voucherUrls, setVoucherUrls] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const ADMIN_PASSWORD = 'SaveYours2024!';
  const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      loadVouchers(selectedSessionId);
    } else {
      setVouchers([]);
    }
  }, [selectedSessionId]);

  const checkAuthentication = () => {
    const isAdmin = localStorage.getItem('adminAuthenticated');
    const authTime = localStorage.getItem('adminAuthTime');

    if (isAdmin === 'true' && authTime) {
      const sessionAge = Date.now() - parseInt(authTime);

      if (sessionAge > SESSION_TIMEOUT) {
        localStorage.removeItem('adminAuthenticated');
        localStorage.removeItem('adminAuthTime');
        setIsAuthenticated(false);
        toast.info('Session expired. Please login again.');
      } else {
        setIsAuthenticated(true);
        loadSessions();
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
      loadSessions();
      toast.success('Login successful');
    } else {
      toast.error('Invalid password');
    }
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('class_sessions')
        .select('*, class:classes(*)')
        .in('status', ['scheduled', 'full'])
        .order('date', { ascending: true });

      if (error) {
        console.error('Error loading sessions:', error);
        toast.error('Failed to load sessions');
      } else {
        setSessions(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const loadVouchers = async (sessionId: string) => {
    const { data, error } = await supabaseHelpers.getVouchersForSession(sessionId);
    if (error) {
      console.error('Error loading vouchers:', error);
      toast.error('Failed to load vouchers');
    } else {
      setVouchers(data || []);
    }
  };

  const handleAddVouchers = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSessionId) {
      toast.error('Please select a session first');
      return;
    }

    const urls = voucherUrls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urls.length === 0) {
      toast.error('Please enter at least one voucher URL');
      return;
    }

    setAdding(true);
    try {
      const { data, error } = await supabaseHelpers.addVouchers(selectedSessionId, urls);

      if (error) {
        console.error('Error adding vouchers:', error);
        toast.error('Failed to add vouchers: ' + (error.message || 'Unknown error'));
      } else {
        toast.success(`Successfully added ${data?.length || urls.length} vouchers`);
        setVoucherUrls('');
        loadVouchers(selectedSessionId);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to add vouchers');
    }
    setAdding(false);
  };

  const getSelectedSession = () => {
    return sessions.find(s => s.id === selectedSessionId);
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

  const selectedSession = getSelectedSession();
  const availableCount = vouchers.filter(v => v.status === 'available').length;
  const assignedCount = vouchers.filter(v => v.status === 'assigned').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold">Voucher Management</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Add Vouchers Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add Vouchers
            </h2>

            <form onSubmit={handleAddVouchers} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Class Session</label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">-- Select a session --</option>
                  {sessions.map(session => (
                    <option key={session.id} value={session.id}>
                      {new Date(session.date + 'T00:00:00').toLocaleDateString()} - {session.class?.name} ({session.current_enrollment}/{session.max_capacity} enrolled)
                    </option>
                  ))}
                </select>
              </div>

              {selectedSession && (
                <div className="bg-gray-50 p-3 rounded-lg text-sm">
                  <p><strong>Class:</strong> {selectedSession.class?.name}</p>
                  <p><strong>Date:</strong> {new Date(selectedSession.date + 'T00:00:00').toLocaleDateString()}</p>
                  <p><strong>Time:</strong> {selectedSession.start_time} - {selectedSession.end_time}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Voucher URLs (one per line)
                </label>
                <textarea
                  value={voucherUrls}
                  onChange={(e) => setVoucherUrls(e.target.value)}
                  placeholder="https://redcross.example.com/voucher/abc123&#10;https://redcross.example.com/voucher/def456&#10;https://redcross.example.com/voucher/ghi789"
                  rows={8}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedSessionId || adding}
                className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {adding ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Vouchers
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Voucher List Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Vouchers for Selected Session
            </h2>

            {!selectedSessionId ? (
              <p className="text-gray-500 italic">Select a session to view its vouchers</p>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold">{vouchers.length}</p>
                    <p className="text-xs text-gray-600">Total</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">{availableCount}</p>
                    <p className="text-xs text-gray-600">Available</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">{assignedCount}</p>
                    <p className="text-xs text-gray-600">Assigned</p>
                  </div>
                </div>

                {/* Voucher List */}
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {vouchers.length === 0 ? (
                    <p className="text-gray-500 italic text-center py-4">No vouchers added yet</p>
                  ) : (
                    vouchers.map(voucher => (
                      <div
                        key={voucher.id}
                        className={`p-3 rounded-lg border ${
                          voucher.status === 'available'
                            ? 'bg-green-50 border-green-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono truncate" title={voucher.voucher_url}>
                              {voucher.voucher_url}
                            </p>
                            {voucher.status === 'assigned' && voucher.assigned_to_email && (
                              <p className="text-xs text-gray-600 mt-1">
                                Assigned to: {voucher.assigned_to_email}
                              </p>
                            )}
                          </div>
                          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                            voucher.status === 'available'
                              ? 'bg-green-200 text-green-800'
                              : 'bg-blue-200 text-blue-800'
                          }`}>
                            {voucher.status === 'available' ? (
                              <Clock className="w-3 h-3" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            {voucher.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

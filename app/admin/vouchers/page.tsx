'use client';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Link as LinkIcon, CheckCircle, Clock, Trash2, Edit, Copy, Check, X } from 'lucide-react';
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

  // CRUD state
  const [selectedVouchers, setSelectedVouchers] = useState<Set<string>>(new Set());
  const [editingVoucher, setEditingVoucher] = useState<VoucherLink | null>(null);
  const [deletingVoucherId, setDeletingVoucherId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const ADMIN_PASSWORD = 'SaveYours2024!';
  const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      loadVouchers(selectedSessionId);
      setSelectedVouchers(new Set());
    } else {
      setVouchers([]);
      setSelectedVouchers(new Set());
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
        toast.success(`Added ${data?.length || urls.length} vouchers`);
        setVoucherUrls('');
        loadVouchers(selectedSessionId);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to add vouchers');
    }
    setAdding(false);
  };

  // Delete single voucher
  const handleDeleteVoucher = async (voucherId: string) => {
    setDeletingVoucherId(voucherId);
    try {
      const { error } = await supabaseHelpers.deleteVoucher(voucherId);
      if (error) {
        console.error('Error deleting voucher:', error);
        toast.error('Failed to delete voucher');
      } else {
        toast.success('Voucher deleted');
        loadVouchers(selectedSessionId);
        setSelectedVouchers(prev => {
          const next = new Set(prev);
          next.delete(voucherId);
          return next;
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to delete voucher');
    }
    setDeletingVoucherId(null);
    setShowDeleteConfirm(null);
  };

  // Delete multiple vouchers
  const handleBulkDelete = async () => {
    if (selectedVouchers.size === 0) return;

    setBulkDeleting(true);
    try {
      const { error } = await supabaseHelpers.deleteVouchers(Array.from(selectedVouchers));
      if (error) {
        console.error('Error deleting vouchers:', error);
        toast.error('Failed to delete vouchers');
      } else {
        toast.success(`Deleted ${selectedVouchers.size} vouchers`);
        setSelectedVouchers(new Set());
        loadVouchers(selectedSessionId);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to delete vouchers');
    }
    setBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
  };

  // Update voucher
  const handleUpdateVoucher = async (voucherId: string, updates: {
    voucher_url?: string;
    status?: 'available' | 'assigned';
    assigned_to_email?: string | null;
    assigned_at?: string | null;
  }) => {
    try {
      const { error } = await supabaseHelpers.updateVoucher(voucherId, updates);
      if (error) {
        console.error('Error updating voucher:', error);
        toast.error('Failed to update voucher');
      } else {
        toast.success('Voucher updated');
        loadVouchers(selectedSessionId);
        setEditingVoucher(null);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update voucher');
    }
  };

  // Copy URL to clipboard
  const copyToClipboard = async (url: string, voucherId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(voucherId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy URL');
    }
  };

  // Toggle voucher selection
  const toggleVoucherSelection = (voucherId: string) => {
    setSelectedVouchers(prev => {
      const next = new Set(prev);
      if (next.has(voucherId)) {
        next.delete(voucherId);
      } else {
        next.add(voucherId);
      }
      return next;
    });
  };

  // Select/deselect all vouchers
  const toggleSelectAll = () => {
    if (selectedVouchers.size === vouchers.length) {
      setSelectedVouchers(new Set());
    } else {
      setSelectedVouchers(new Set(vouchers.map(v => v.id)));
    }
  };

  const getSelectedSession = () => {
    return sessions.find(s => s.id === selectedSessionId);
  };

  const truncateUrl = (url: string, maxLength: number = 40) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
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
        {/* Session Selector */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Select Class Session</h2>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full md:w-96 px-3 py-2 border rounded-lg"
          >
            <option value="">-- Select a session --</option>
            {sessions.map(session => (
              <option key={session.id} value={session.id}>
                {new Date(session.date + 'T00:00:00').toLocaleDateString()} - {session.class?.name} ({session.current_enrollment}/{session.max_capacity} enrolled)
              </option>
            ))}
          </select>

          {selectedSession && (
            <div className="mt-4 bg-gray-50 p-4 rounded-lg">
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div><strong>Class:</strong> {selectedSession.class?.name}</div>
                <div><strong>Date:</strong> {new Date(selectedSession.date + 'T00:00:00').toLocaleDateString()}</div>
                <div><strong>Time:</strong> {selectedSession.start_time} - {selectedSession.end_time}</div>
              </div>
            </div>
          )}
        </div>

        {selectedSessionId && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Stats */}
            <div className="lg:col-span-3 grid grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow text-center">
                <p className="text-3xl font-bold">{vouchers.length}</p>
                <p className="text-sm text-gray-600">Total Vouchers</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg shadow text-center">
                <p className="text-3xl font-bold text-green-600">{availableCount}</p>
                <p className="text-sm text-gray-600">Available</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg shadow text-center">
                <p className="text-3xl font-bold text-blue-600">{assignedCount}</p>
                <p className="text-sm text-gray-600">Assigned</p>
              </div>
            </div>

            {/* Add Vouchers Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add Vouchers
              </h2>

              <form onSubmit={handleAddVouchers} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Voucher URLs (one per line)
                  </label>
                  <textarea
                    value={voucherUrls}
                    onChange={(e) => setVoucherUrls(e.target.value)}
                    placeholder="https://redcross.example.com/voucher/abc123&#10;https://redcross.example.com/voucher/def456"
                    rows={8}
                    className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={adding}
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

            {/* Voucher Table */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" />
                  Vouchers
                </h2>

                {selectedVouchers.size > 0 && (
                  <button
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    disabled={bulkDeleting}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-2 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Selected ({selectedVouchers.size})
                  </button>
                )}
              </div>

              {vouchers.length === 0 ? (
                <p className="text-gray-500 italic text-center py-8">No vouchers added yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">
                          <input
                            type="checkbox"
                            checked={selectedVouchers.size === vouchers.length && vouchers.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded"
                          />
                        </th>
                        <th className="px-3 py-2 text-left">Voucher URL</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left hidden md:table-cell">Assigned To</th>
                        <th className="px-3 py-2 text-left hidden lg:table-cell">Assigned Date</th>
                        <th className="px-3 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vouchers.map(voucher => (
                        <tr key={voucher.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedVouchers.has(voucher.id)}
                              onChange={() => toggleVoucherSelection(voucher.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs" title={voucher.voucher_url}>
                                {truncateUrl(voucher.voucher_url, 30)}
                              </span>
                              <button
                                onClick={() => copyToClipboard(voucher.voucher_url, voucher.id)}
                                className="text-gray-500 hover:text-gray-700 p-1"
                                title="Copy URL"
                              >
                                {copiedId === voucher.id ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                              voucher.status === 'available'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {voucher.status === 'available' ? (
                                <Clock className="w-3 h-3" />
                              ) : (
                                <CheckCircle className="w-3 h-3" />
                              )}
                              {voucher.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 hidden md:table-cell">
                            <span className="text-gray-600">
                              {voucher.assigned_to_email || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2 hidden lg:table-cell">
                            <span className="text-gray-600">
                              {formatDate(voucher.assigned_at)}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingVoucher(voucher)}
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title="Edit voucher"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(voucher.id)}
                                disabled={deletingVoucherId === voucher.id}
                                className="text-red-600 hover:text-red-800 p-1 disabled:opacity-50"
                                title="Delete voucher"
                              >
                                {deletingVoucherId === voucher.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mobile view for assigned info */}
              <div className="md:hidden mt-4 space-y-2">
                {vouchers.filter(v => v.status === 'assigned').map(voucher => (
                  <div key={`mobile-${voucher.id}`} className="bg-blue-50 p-3 rounded-lg text-sm">
                    <p className="font-mono text-xs truncate">{voucher.voucher_url}</p>
                    <p className="text-gray-600 mt-1">Assigned to: {voucher.assigned_to_email}</p>
                    <p className="text-gray-600">Date: {formatDate(voucher.assigned_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Voucher Modal */}
      {editingVoucher && (
        <EditVoucherModal
          voucher={editingVoucher}
          onClose={() => setEditingVoucher(null)}
          onSave={handleUpdateVoucher}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Voucher"
          message="Delete this voucher? This cannot be undone."
          confirmText="Delete"
          onConfirm={() => handleDeleteVoucher(showDeleteConfirm)}
          onCancel={() => setShowDeleteConfirm(null)}
          isLoading={deletingVoucherId === showDeleteConfirm}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <ConfirmModal
          title="Delete Vouchers"
          message={`Delete ${selectedVouchers.size} vouchers? This cannot be undone.`}
          confirmText="Delete All"
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
          isLoading={bulkDeleting}
        />
      )}
    </div>
  );
}

// Edit Voucher Modal Component
function EditVoucherModal({
  voucher,
  onClose,
  onSave
}: {
  voucher: VoucherLink;
  onClose: () => void;
  onSave: (voucherId: string, updates: {
    voucher_url?: string;
    status?: 'available' | 'assigned';
    assigned_to_email?: string | null;
    assigned_at?: string | null;
  }) => void;
}) {
  const [formData, setFormData] = useState({
    voucher_url: voucher.voucher_url,
    status: voucher.status as 'available' | 'assigned',
    assigned_to_email: voucher.assigned_to_email || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const updates: {
      voucher_url?: string;
      status?: 'available' | 'assigned';
      assigned_to_email?: string | null;
      assigned_at?: string | null;
    } = {
      voucher_url: formData.voucher_url,
      status: formData.status,
      assigned_to_email: formData.status === 'available' ? null : (formData.assigned_to_email || null),
      assigned_at: formData.status === 'available' ? null : (voucher.assigned_at || new Date().toISOString())
    };

    await onSave(voucher.id, updates);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Edit Voucher</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Voucher URL</label>
            <input
              type="url"
              required
              value={formData.voucher_url}
              onChange={(e) => setFormData({ ...formData, voucher_url: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'available' | 'assigned' })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
            </select>
          </div>

          {formData.status === 'assigned' && (
            <div>
              <label className="block text-sm font-medium mb-1">Assigned To (Email)</label>
              <input
                type="email"
                value={formData.assigned_to_email}
                onChange={(e) => setFormData({ ...formData, assigned_to_email: e.target.value })}
                placeholder="email@example.com"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
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

// Confirm Modal Component
function ConfirmModal({
  title,
  message,
  confirmText,
  onConfirm,
  onCancel,
  isLoading
}: {
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Deleting...
              </>
            ) : (
              confirmText
            )}
          </button>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 disabled:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, MapPin, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { toast } from '@/components/ui/Toaster';
import type { Enrollment } from '@/types';

type Stage = 'checking' | 'enter-email' | 'enter-code' | 'authenticated';

export default function UserDashboard() {
  const [stage, setStage] = useState<Stage>('checking');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [mountedAt] = useState(() => Date.now());

  const loadEnrollments = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/student/enrollments', { cache: 'no-store' });
      if (res.status === 401) {
        setStage('enter-email');
        setEnrollments([]);
        return;
      }
      if (!res.ok) {
        setErrorMessage('Could not load your enrollments right now. Please try again.');
        setEnrollments([]);
        return;
      }
      const data = await res.json();
      setEnrollments(Array.isArray(data.enrollments) ? data.enrollments : []);
    } catch {
      setErrorMessage('Could not load your enrollments right now. Please try again.');
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Probe the session cookie on mount — decides whether to render the OTP
  // flow or the enrollments list. No email input trust — the whole flow is
  // driven by the signed cookie.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/student/session', { cache: 'no-store' });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (typeof data?.email === 'string') setEmail(data.email);
          setStage('authenticated');
          loadEnrollments();
        } else {
          setStage('enter-email');
        }
      } catch {
        if (!cancelled) setStage('enter-email');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadEnrollments]);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setErrorMessage('');
    try {
      await fetch('/api/student/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), website, mountedAt }),
      });
      // Response is always 200/silent — never reveal whether the email
      // exists. Move to the code step unconditionally.
      setPendingEmail(email.trim().toLowerCase());
      setStage('enter-code');
    } catch {
      // Network failure only — the API call is designed not to throw.
      setErrorMessage('Could not send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setErrorMessage('Enter the 6-digit code we sent to your email.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/student/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code }),
      });
      if (!res.ok) {
        setErrorMessage('That code is invalid or expired. Check your email or request a new one.');
        return;
      }
      const data = await res.json();
      if (typeof data?.email === 'string') setEmail(data.email);
      setCode('');
      setStage('authenticated');
      loadEnrollments();
    } catch {
      setErrorMessage('Could not verify the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/student/logout', { method: 'POST' });
    } catch {
      // Non-fatal; cookie is cleared server-side on any successful request.
    }
    setEnrollments([]);
    setEmail('');
    setPendingEmail('');
    setCode('');
    setErrorMessage('');
    setStage('enter-email');
    toast.info('Signed out');
  };

  if (stage === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (stage === 'enter-email') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">View Your Classes</h1>
          <p className="text-sm text-gray-600 text-center mb-6">
            Enter the email you used to register. We&rsquo;ll send you a 6-digit code
            to verify it&rsquo;s you.
          </p>
          <form onSubmit={requestCode} className="space-y-4">
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
            />
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send Code'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (stage === 'enter-code') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Check Your Email</h1>
          <p className="text-sm text-gray-600 text-center mb-6">
            We sent a 6-digit code to <span className="font-medium">{pendingEmail}</span>.
            It expires in 10 minutes.
          </p>
          <form onSubmit={verifyCode} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full px-4 py-3 border rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-primary-500"
            />
            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage('enter-email');
                setCode('');
                setErrorMessage('');
              }}
              className="w-full text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Use a different email
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated stage — render the enrollments (or an error/empty state).
  const upcomingClasses = enrollments.filter(
    (e) => e.session && new Date(e.session.date) >= new Date()
  );
  const completedClasses = enrollments.filter((e) => e.status === 'completed');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Dashboard</h1>
            <p className="text-gray-600">
              Signed in as <span className="font-medium">{email}</span>.
            </p>
          </div>
          <button
            onClick={logout}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Sign out
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : errorMessage ? (
          <div className="bg-white border-l-4 border-red-500 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-red-700 mb-2">
              Enrollments unavailable
            </h2>
            <p className="text-gray-700 mb-4">{errorMessage}</p>
            <button
              onClick={loadEnrollments}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm"
            >
              Retry
            </button>
          </div>
        ) : enrollments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Classes Found</h2>
            <p className="text-gray-600">
              You don&rsquo;t have any enrollments on this email address yet.
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Upcoming Classes</h2>
              {upcomingClasses.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                  No upcoming classes
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingClasses.map((enrollment) => (
                    <div key={enrollment.id} className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="font-semibold text-lg mb-2">
                        {enrollment.session?.class?.name}
                      </h3>
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          {enrollment.session?.date &&
                            new Date(enrollment.session.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          {enrollment.session?.start_time} - {enrollment.session?.end_time}
                        </div>
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-2" />
                          Bloomington, MN
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

            <div>
              <h2 className="text-xl font-semibold mb-4">Completed Classes</h2>
              {completedClasses.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                  No completed classes yet
                </div>
              ) : (
                <div className="space-y-4">
                  {completedClasses.map((enrollment) => (
                    <div key={enrollment.id} className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg mb-2">
                            {enrollment.session?.class?.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Completed:{' '}
                            {enrollment.completed_at &&
                              new Date(enrollment.completed_at).toLocaleDateString()}
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
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Clock, MapPin, ShoppingCart, Users, ChevronRight } from 'lucide-react';
import { toast } from '@/components/ui/Toaster';
import { supabaseHelpers } from '@/lib/supabase';
import { BLENDED_EXPLAINER_SENTENCES, isBlendedClass } from '@/lib/blended-copy';
import type { ClassInfo } from '@/lib/class-info';
import { ANSWER_PARAGRAPHS } from './answer-paragraph';

// Session-card render is duplicated from /classes so both surfaces render
// identically. Do NOT introduce a second checkout path — addToCart writes
// to the same localStorage key /classes uses, and the cart page owns the
// rest of the funnel.
interface SessionRow {
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

function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function ClassPageClient({ info }: { info: ClassInfo }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseHelpers.getAvailableSessions();
      setSessions((data as SessionRow[] | null) ?? []);
      setLoading(false);
    })();
  }, []);

  // Same source /classes uses (getAvailableSessions filters status='scheduled'
  // in Supabase). We further narrow to this class by dbType or dbName, and
  // drop any past dates client-side.
  const todayIso = new Date().toISOString().split('T')[0];
  const upcoming = sessions.filter(
    s =>
      (s.class?.type === info.dbType || s.class?.name === info.dbName) &&
      s.status === 'scheduled' &&
      s.date >= todayIso
  );

  const addToCart = (session: SessionRow) => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]') as SessionRow[];
    if (cart.find(item => item.id === session.id)) {
      toast.info('This class is already in your cart');
      return;
    }
    cart.push(session);
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('storage'));
    toast.success('Added to cart!');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="bg-white border-b">
        <div className="container-custom py-3">
          <ol className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
            <li><Link href="/" className="hover:text-primary-600 underline underline-offset-2">Home</Link></li>
            <li aria-hidden="true"><ChevronRight className="w-4 h-4 inline text-gray-400" /></li>
            <li><Link href="/classes" className="hover:text-primary-600 underline underline-offset-2">Classes</Link></li>
            <li aria-hidden="true"><ChevronRight className="w-4 h-4 inline text-gray-400" /></li>
            <li className="text-gray-900 font-medium" aria-current="page">{info.displayName}</li>
          </ol>
        </div>
      </nav>

      {/* Header + answer paragraph */}
      <section className="bg-white border-b">
        <div className="container-custom py-8 sm:py-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{info.displayName}</h1>
          <p className="text-lg text-gray-700 max-w-3xl">{ANSWER_PARAGRAPHS[info.slug]}</p>
        </div>
      </section>

      {/* Detail sections */}
      <section className="container-custom py-8 sm:py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="card p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Who this class is for</h2>
              <ul className="list-disc list-outside pl-6 space-y-2 text-gray-700">
                {info.whoFor.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="card p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">What you&rsquo;ll learn</h2>
              <ul className="list-disc list-outside pl-6 space-y-2 text-gray-700">
                {info.whatYouLearn.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="card p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">How the blended course works</h2>
              <p className="text-gray-700 mb-3">
                The course has two parts. {BLENDED_EXPLAINER_SENTENCES[0]}
              </p>
              <p className="text-gray-700 mb-3">
                Bring proof of your online completion to the in-person session — printed or on your
                phone. Without it we can&rsquo;t certify you that day.
              </p>
              <p className="text-gray-700">
                The in-person portion is where you demonstrate the skills on a manikin with an
                instructor. Both parts are required — you can&rsquo;t certify with only one.
              </p>
            </div>

            <div className="card p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Class details</h2>
              <p className="text-gray-700">
                Tuition is ${info.price}. Certification is valid for {info.certValidYears} years
                from the date of the in-person class. Every session is capped at {info.maxStudents} students.
                The Red Cross course code is <span className="font-medium">{info.dbName}</span>.
              </p>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="card p-6 bg-primary-50 border border-primary-100">
              <p className="text-sm uppercase tracking-wide text-primary-700 font-semibold mb-1">Tuition</p>
              <p className="text-4xl font-bold text-primary-600 mb-4">${info.price}</p>
              <p className="text-sm text-gray-700 mb-4">
                {info.audience} · Valid for {info.certValidYears} years · Class size max {info.maxStudents}
              </p>
              <p className="text-sm text-gray-700">
                Questions before you register?{' '}
                <Link href="/faq" className="text-primary-600 underline hover:opacity-80">See the FAQ</Link>
                {' '}or{' '}
                <Link href="/contact" className="text-primary-600 underline hover:opacity-80">contact us</Link>.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* Upcoming dates */}
      <section className="container-custom pb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Upcoming dates</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner" />
          </div>
        ) : upcoming.length === 0 ? (
          <div className="card p-6 sm:p-8 bg-white">
            <p className="text-gray-700 mb-4">
              No dates are currently scheduled for this class. We run it on request for groups
              and individuals — get in touch and we&rsquo;ll set one up.
            </p>
            <Link
              href="/contact"
              className="btn btn-primary inline-flex items-center gap-2"
            >
              Contact us to schedule
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcoming.map(session => (
              <div key={session.id} className="card hover:shadow-xl transition-all">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{session.class?.name}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          session.class?.audience === 'healthcare'
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {session.class?.audience === 'healthcare' ? 'Healthcare' : 'General Public'}
                        </span>
                        {isBlendedClass(session.class) && (
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#1B2A4A] text-white">
                            Blended
                          </span>
                        )}
                      </div>
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
                        year: 'numeric',
                      })}
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      {formatTime(session.start_time)} - {formatTime(session.end_time)}
                    </div>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2" />
                      Bloomington, MN
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
        )}

        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link href="/classes" className="text-primary-600 hover:underline">See all classes</Link>
          <Link href="/faq" className="text-primary-600 hover:underline">Read the FAQ</Link>
        </div>
      </section>
    </div>
  );
}

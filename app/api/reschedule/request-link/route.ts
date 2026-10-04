import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkFormSubmission } from '@/lib/form-guard'
import { signRescheduleToken, classStartUtc, RESCHEDULE_POLICY } from '@/lib/reschedule'
import { getTransporterLikeEmail } from '@/lib/reschedule-email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SILENT_OK = { ok: true } as const

function silentOk() {
  return NextResponse.json(SILENT_OK)
}

// POST /api/reschedule/request-link
// body: { email }
// Finds every upcoming, non-cancelled enrollment for the normalized email and
// emails one reschedule link per enrollment. Always returns {ok:true} so the
// UI message ("if we found a booking, we've emailed a link") never leaks
// whether an email exists. Rate-limited via form-guard (3/hour per normalized
// email).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  const guard = checkFormSubmission(req, body, {
    formName: 'reschedule-request-link',
    honeypot: true,
    emailField: 'email',
    rateLimit: { maxPerHour: 3, identifierField: 'email' },
  })
  if (guard.decision === 'silent-accept') return silentOk()

  const rawEmail = typeof body?.email === 'string' ? body.email : ''
  const email = rawEmail.trim().toLowerCase()
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) return silentOk()

  // Pull every upcoming, non-cancelled, non-completed enrollment for this
  // email. We don't filter "future" at the DB level because `date` is a
  // string and "today" cares about Chicago time — we filter in JS after
  // using classStartUtc.
  const { data: rows, error } = await supabaseAdmin
    .from('enrollments')
    .select(
      'id, status, guest_email, session:class_sessions(id, date, start_time, end_time, status, archived_at, class:classes(id, name))'
    )
    .ilike('guest_email', email)
    .not('status', 'in', '("cancelled","completed")')
    .limit(50)

  if (error) {
    console.error('[RESCHEDULE_REQUEST_LINK] Enrollment lookup failed:', error)
    return silentOk()
  }

  const now = new Date()
  type Row = {
    id: string
    status: string
    guest_email: string | null
    session: {
      id: string
      date: string
      start_time: string
      end_time: string
      status: string | null
      archived_at: string | null
      class: { id: string; name: string } | Array<{ id: string; name: string }>
    } | Array<unknown> | null
  }

  const eligible = ((rows ?? []) as unknown as Row[]).filter((r) => {
    const sess = Array.isArray(r.session) ? r.session[0] : r.session
    if (!sess || typeof sess !== 'object') return false
    const s = sess as {
      id: string
      date: string
      start_time: string
      status: string | null
      archived_at: string | null
    }
    if (s.status === 'cancelled') return false
    if (s.archived_at) return false
    try {
      const startUtc = classStartUtc(s.date, s.start_time)
      // Allow the student to request a link even inside the 24h window — the
      // token page will show the "too late" message. Only hide classes that
      // have already started.
      return startUtc.getTime() > now.getTime()
    } catch {
      return false
    }
  })

  const sender = await getTransporterLikeEmail()

  for (const r of eligible) {
    const sess = Array.isArray(r.session) ? r.session[0] : r.session
    if (!sess || typeof sess !== 'object') continue
    const session = sess as {
      id: string
      date: string
      start_time: string
      class: { id: string; name: string } | Array<{ id: string; name: string }>
    }
    const className = Array.isArray(session.class) ? session.class[0]?.name : session.class?.name
    const token = signRescheduleToken(r.id)
    const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://saveyours.net').replace(/\/+$/, '')
    const url = `${base}/reschedule?token=${encodeURIComponent(token)}`
    const expiresDays = Math.round(RESCHEDULE_POLICY.tokenTtlSeconds / 86400)
    try {
      await sender(r.guest_email ?? email, className ?? 'your class', url, session.date, expiresDays)
    } catch (sendErr) {
      console.error('[RESCHEDULE_REQUEST_LINK] Email send failed:', { enrollmentId: r.id, sendErr })
    }
  }

  return silentOk()
}

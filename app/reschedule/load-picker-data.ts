import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  checkEligibility,
  classStartUtc,
  rescheduleFee,
  RESCHEDULE_POLICY_SUMMARY,
} from '@/lib/reschedule'

export type PickerSession = {
  id: string
  date: string
  start_time: string
  end_time: string
  class_id: string
  max_capacity: number
  seats_taken: number
}

export type PickerData =
  | { ok: false; message: string }
  | {
      ok: true
      enrollmentId: string
      className: string
      from: {
        id: string
        date: string
        start_time: string
        end_time: string
      }
      feeCents: number
      amountPaid: number | null
      policyText: string
      targets: PickerSession[]
    }

// Load everything the token-page needs: enrollment row, source session,
// and candidate target sessions (same class, future, scheduled, not archived,
// with authoritative seat counts). All eligibility is re-run server-side —
// the client-side list is informational only.
export async function loadReschedulePickerData(enrollmentId: string): Promise<PickerData> {
  const { data: enrollment, error: enrollErr } = await supabaseAdmin
    .from('enrollments')
    .select(
      'id, status, amount_paid, guest_name, guest_email, session_id, session:class_sessions(id, date, start_time, end_time, status, archived_at, current_enrollment, max_capacity, class_id, class:classes(id, name, price))'
    )
    .eq('id', enrollmentId)
    .maybeSingle()

  if (enrollErr) {
    console.error('[RESCHEDULE_LOAD] Enrollment fetch failed:', enrollErr)
    return { ok: false, message: 'We could not load this enrollment.' }
  }
  if (!enrollment) {
    return { ok: false, message: 'That reschedule link no longer matches an enrollment.' }
  }

  const sessionField = (enrollment as { session?: unknown }).session
  const fromRaw = Array.isArray(sessionField) ? sessionField[0] : sessionField
  const classFieldAtAny = fromRaw && typeof fromRaw === 'object' ? (fromRaw as { class?: unknown }).class : null
  const classField = Array.isArray(classFieldAtAny) ? classFieldAtAny[0] : classFieldAtAny
  if (
    !fromRaw ||
    typeof fromRaw !== 'object' ||
    !classField ||
    typeof classField !== 'object'
  ) {
    return { ok: false, message: 'This enrollment is missing its session or class row.' }
  }
  const fromSession = fromRaw as {
    id: string
    date: string
    start_time: string
    end_time: string
    status: string | null
    archived_at: string | null
    current_enrollment: number
    max_capacity: number
    class_id: string
  }
  const cls = classField as { id: string; name: string; price: number }

  const now = new Date()

  // Try to compute class start to detect "too late" / "already started"
  // without needing a target session yet. If the enrollment itself is already
  // cancelled/completed we also short-circuit here.
  if (enrollment.status === 'cancelled') {
    return { ok: false, message: 'This enrollment has been cancelled, so it cannot be rescheduled.' }
  }
  if (enrollment.status === 'completed') {
    return { ok: false, message: 'This enrollment has already been completed and cannot be rescheduled.' }
  }
  try {
    const startUtc = classStartUtc(fromSession.date, fromSession.start_time)
    const diffMs = startUtc.getTime() - now.getTime()
    if (diffMs <= 0) {
      return { ok: false, message: 'This class has already started, so it cannot be rescheduled online.' }
    }
    if (diffMs < 24 * 60 * 60 * 1000) {
      return {
        ok: false,
        message:
          'This class starts in less than 24 hours. Online rescheduling is closed — email info@saveyours.net if you need help.',
      }
    }
  } catch (err) {
    console.error('[RESCHEDULE_LOAD] classStartUtc threw:', err)
    return { ok: false, message: 'We could not read your class start time.' }
  }

  // Pull same-class target candidates. We fetch broadly and let
  // checkEligibility narrow — the list is small (single-digit sessions).
  const todayIso = new Date().toISOString().split('T')[0]
  const { data: candidates, error: candidateErr } = await supabaseAdmin
    .from('class_sessions')
    .select('id, date, start_time, end_time, status, archived_at, current_enrollment, max_capacity, class_id')
    .eq('class_id', fromSession.class_id)
    .eq('status', 'scheduled')
    .gte('date', todayIso)
    .is('archived_at', null)
    .order('date', { ascending: true })

  if (candidateErr) {
    console.error('[RESCHEDULE_LOAD] Candidate fetch failed:', candidateErr)
    return { ok: false, message: 'We could not load alternative dates right now.' }
  }

  // Pull real seat counts (status<>'cancelled') for every candidate at once.
  // The counter has drifted historically; we must gate on the real count so
  // the DB function won't surprise us at payment time.
  const ids = (candidates ?? []).map((c) => c.id)
  const seatMap = new Map<string, number>()
  if (ids.length > 0) {
    // Head-count queries don't like IN with lots of columns, so we loop. The
    // candidate list is small — single digits in practice.
    for (const id of ids) {
      const { count } = await supabaseAdmin
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', id)
        .neq('status', 'cancelled')
      seatMap.set(id, count ?? 0)
    }
  }

  const targets: PickerSession[] = []
  for (const c of candidates ?? []) {
    const seatsTaken = seatMap.get(c.id) ?? 0
    const eligibility = checkEligibility({
      enrollment: { status: enrollment.status, session_id: enrollment.session_id },
      fromSession,
      toSession: c as unknown as Parameters<typeof checkEligibility>[0]['toSession'],
      now,
      toSessionSeatsTaken: seatsTaken,
    })
    if (eligibility.ok) {
      targets.push({
        id: c.id,
        date: c.date,
        start_time: c.start_time,
        end_time: c.end_time,
        class_id: c.class_id,
        max_capacity: c.max_capacity,
        seats_taken: seatsTaken,
      })
    }
  }

  const feeCents = rescheduleFee(enrollment.amount_paid, cls.price)

  return {
    ok: true,
    enrollmentId,
    className: cls.name,
    from: {
      id: fromSession.id,
      date: fromSession.date,
      start_time: fromSession.start_time,
      end_time: fromSession.end_time,
    },
    feeCents,
    amountPaid: typeof enrollment.amount_paid === 'number' ? enrollment.amount_paid : null,
    policyText: RESCHEDULE_POLICY_SUMMARY,
    targets,
  }
}

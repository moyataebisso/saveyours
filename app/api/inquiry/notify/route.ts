import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendAdminAlert } from '@/lib/email'

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined || value === '') return '&mdash;'
  const str = String(value)
  if (str.trim() === '') return '&mdash;'
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Server-side validation. The client used to insert the inquiry directly into
// Supabase with the anon key; that path is gone. Every field is coerced to a
// string here, trimmed, and length-capped. Anything not in this shape is
// dropped — the client payload shape is not trusted.
const NAME_MAX = 200
const EMAIL_MAX = 320
const PHONE_MAX = 40
const SERVICE_TYPE_MAX = 100
const LOCATION_MAX = 500
const PREFERRED_DATES_MAX = 500
const MESSAGE_MAX = 5000
const PARTICIPANTS_MAX = 100000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type SanitizedInquiry = {
  name: string
  email: string
  phone: string | null
  service_type: string | null
  location: string | null
  participants: number | null
  preferred_dates: string | null
  message: string
}

function sanitizeString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  if (trimmed.length === 0) return null
  return trimmed.slice(0, max)
}

function sanitizeParticipants(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (!Number.isFinite(n) || n < 1 || n > PARTICIPANTS_MAX) return null
  return Math.floor(n)
}

function validate(body: unknown): { ok: true; data: SanitizedInquiry } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' }
  }
  const b = body as Record<string, unknown>

  const name = sanitizeString(b.name, NAME_MAX)
  const email = sanitizeString(b.email, EMAIL_MAX)
  const message = sanitizeString(b.message, MESSAGE_MAX)

  if (!name) return { ok: false, error: 'Name is required' }
  if (!email) return { ok: false, error: 'Email is required' }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Email format is invalid' }
  if (!message) return { ok: false, error: 'Message is required' }

  return {
    ok: true,
    data: {
      name,
      email: email.toLowerCase(),
      phone: sanitizeString(b.phone, PHONE_MAX),
      service_type: sanitizeString(b.service_type, SERVICE_TYPE_MAX),
      location: sanitizeString(b.location, LOCATION_MAX),
      participants: sanitizeParticipants(b.participants),
      preferred_dates: sanitizeString(b.preferred_dates, PREFERRED_DATES_MAX),
      message,
    },
  }
}

// Contact form target. Persists the inquiry row (previously done client-side
// with the anon key) AND emails info@saveyours.net. Validation runs
// server-side — nothing about the client payload shape is trusted.
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validate(body)
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  const inquiry = result.data

  const { error: insertError } = await supabaseAdmin
    .from('inquiries')
    .insert([inquiry])

  if (insertError) {
    console.error('[INQUIRY_NOTIFY] Failed to insert inquiry:', insertError)
    return NextResponse.json({ error: 'Failed to save inquiry' }, { status: 500 })
  }

  // Email is best-effort. Row is saved; if the notification email fails the
  // admin can still see it in the dashboard, so we don't fail the request.
  try {
    const subject = `New inquiry from ${inquiry.name}`
    const submittedAt = new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'full',
      timeStyle: 'short',
    })

    const rows: Array<[string, unknown]> = [
      ['Email', inquiry.email],
      ['Phone', inquiry.phone],
      ['Name', inquiry.name],
      ['Service Type', inquiry.service_type],
      ['Location', inquiry.location],
      ['Participants', inquiry.participants],
      ['Preferred Dates', inquiry.preferred_dates],
      ['Message', inquiry.message],
      ['Submitted', submittedAt],
    ]

    const htmlContent = `
      <h2 style="font-family:Arial,sans-serif;color:#333;">New Website Inquiry</h2>
      <table style="border-collapse:collapse;margin:16px 0;font-family:Arial,sans-serif;color:#333;">
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <td style="padding:8px 12px;font-weight:bold;vertical-align:top;border-bottom:1px solid #eee;white-space:nowrap;">${escapeHtml(label)}:</td>
                <td style="padding:8px 12px;vertical-align:top;border-bottom:1px solid #eee;white-space:pre-wrap;">${escapeHtml(value)}</td>
              </tr>
            `
          )
          .join('')}
      </table>
    `

    await sendAdminAlert(subject, htmlContent)
  } catch (err) {
    console.error('[INQUIRY_NOTIFY] Failed to send inquiry email (row still saved):', err)
  }

  return NextResponse.json({ ok: true })
}

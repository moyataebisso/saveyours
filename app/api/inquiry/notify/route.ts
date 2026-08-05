import { NextRequest, NextResponse } from 'next/server'
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

// Fire-and-forget target for the contact form. The inquiry row is already
// persisted in Supabase by the client before this route is called; this exists
// solely to notify info@saveyours.net so leads aren't missed. Any failure
// returns { ok: false } at HTTP 200 — the user has already seen the success
// toast and must not see an error surface.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string
      email?: string
      phone?: string
      service_type?: string
      location?: string
      participants?: number | string
      preferred_dates?: string
      message?: string
    }

    const trimmedName = typeof body.name === 'string' ? body.name.trim() : ''
    const subject = trimmedName ? `New inquiry from ${trimmedName}` : 'New website inquiry'

    const submittedAt = new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'full',
      timeStyle: 'short',
    })

    // Email + phone first so she can reply from her inbox without scrolling.
    const rows: Array<[string, unknown]> = [
      ['Email', body.email],
      ['Phone', body.phone],
      ['Name', body.name],
      ['Service Type', body.service_type],
      ['Location', body.location],
      ['Participants', body.participants],
      ['Preferred Dates', body.preferred_dates],
      ['Message', body.message],
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
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[INQUIRY_NOTIFY] Failed to send inquiry email:', err)
    return NextResponse.json({ ok: false })
  }
}

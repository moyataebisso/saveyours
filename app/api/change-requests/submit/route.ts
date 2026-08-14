import { arsiSupabase } from '@/lib/arsi-supabase'
import { escapeHtml } from '@/lib/email'
import { checkFormSubmission } from '@/lib/form-guard'
import { Resend } from 'resend'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))

  const guard = checkFormSubmission(request, body, {
    formName: 'change-request',
    honeypot: true,
    timing: { minSeconds: 3 },
    rateLimit: { maxPerHour: 5, identifierField: 'clientEmail' },
  })
  if (guard.decision === 'silent-accept') {
    return Response.json({ success: true, id: null })
  }

  const { description, requestType, priority } = body ?? {}

  if (!description || String(description).trim().length < 10) {
    return Response.json(
      { error: 'Please describe your request (at least 10 characters)' },
      { status: 400 }
    )
  }

  const { data, error } = await arsiSupabase
    .from('change_requests')
    .insert({
      client_email: 'admin@saveyours.net',
      business_name: 'SaveYours',
      request_type: requestType || 'general',
      description: description.trim(),
      priority: priority || 'normal',
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return Response.json(
      { error: 'Failed to submit' },
      { status: 500 }
    )
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const safeType = escapeHtml(requestType || 'general')
    const safePriority = escapeHtml(priority || 'normal')
    const safeDescription = escapeHtml(description.trim())
    const safeId = escapeHtml(data.id)
    // Email subject is a plain-text header; strip CR/LF to prevent header
    // injection if a caller ever sneaks newlines into requestType.
    const subjectType = String(requestType || 'general').replace(/[\r\n]/g, ' ').slice(0, 100)
    await resend.emails.send({
      from: `Cimaa Sites <${process.env.RESEND_FROM_EMAIL || 'noreply@arsitechgroup.com'}>`,
      to: 'arsitechgroup@gmail.com',
      subject: `[SaveYours] New Change Request: ${subjectType}`,
      html: `
        <h2>New change request for SaveYours</h2>
        <p><strong>Type:</strong> ${safeType}</p>
        <p><strong>Priority:</strong> ${safePriority}</p>
        <p><strong>Request:</strong> ${safeDescription}</p>
        <p><small>ID: ${safeId}</small></p>
      `
    })
  } catch (e: any) {
    console.error('Email failed:', e?.message || e)
    // Don't fail the request — just log it
  }

  return Response.json({ success: true, id: data.id })
}

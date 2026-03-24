import { arsiSupabase } from '@/lib/arsi-supabase'
import { Resend } from 'resend'

export async function POST(request: Request) {
  const { description, requestType, priority } = await request.json()

  if (!description || description.trim().length < 10) {
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
    await resend.emails.send({
      from: `Cimaa Sites <${process.env.RESEND_FROM_EMAIL || 'noreply@arsitechgroup.com'}>`,
      to: 'arsitechgroup@gmail.com',
      subject: `[SaveYours] New Change Request: ${requestType}`,
      html: `
        <h2>New change request for SaveYours</h2>
        <p><strong>Type:</strong> ${requestType}</p>
        <p><strong>Priority:</strong> ${priority}</p>
        <p><strong>Request:</strong> ${description}</p>
        <p><small>ID: ${data.id}</small></p>
      `
    })
  } catch (e: any) {
    console.error('Email failed:', e?.message || e)
    // Don't fail the request — just log it
  }

  return Response.json({ success: true, id: data.id })
}

import 'server-only'
import nodemailer from 'nodemailer'
import { escapeHtml } from './email'

// Minimal mailer wrapper for the "send me a reschedule link" flow. Kept in a
// separate file so lib/email.ts doesn't grow a second code path to maintain
// (the enrollment-confirmation templates there are heavier and have their
// own history of double-format / HTML-escaping fixes).
let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })
  }
  return transporter
}

// Returned as a function so the API route doesn't have to know anything
// about nodemailer. The outer async also lets us swap in a different
// transport in future without churning the call sites.
export async function getTransporterLikeEmail() {
  return async (
    to: string,
    className: string,
    rescheduleUrl: string,
    classDate: string,
    expiresDays: number
  ) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #DC2626; color: white; padding: 20px; text-align: center;">
            <h1 style="margin:0;">Reschedule your SaveYours class</h1>
          </div>
          <div style="padding: 20px; background-color: #f9f9f9;">
            <p>We received a reschedule request for your enrollment in <strong>${escapeHtml(className)}</strong> on ${escapeHtml(classDate)}.</p>
            <p>Click the button below to pick a new date. Rescheduling is available up to 24 hours before your class starts, for a 50% fee.</p>
            <p style="text-align:center; margin: 24px 0;">
              <a href="${escapeHtml(rescheduleUrl)}" style="background-color: #DC2626; color: #FFFFFF; padding: 15px 25px; text-decoration: none; display: inline-block; border-radius: 5px; font-weight: bold;">Reschedule this class</a>
            </p>
            <p style="font-size: 12px; color: #666;">This link expires in ${expiresDays} days. If you didn&rsquo;t request this, you can safely ignore the email.</p>
          </div>
        </div>
      </body>
      </html>
    `
    const info = await getTransporter().sendMail({
      from: '"SaveYours Training" <info@saveyours.net>',
      to,
      subject: `Reschedule your ${className} class`,
      html,
    })
    return { success: true, messageId: info.messageId }
  }
}

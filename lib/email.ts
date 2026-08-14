import nodemailer from 'nodemailer'
import { BLENDED_EXPLAINER_SENTENCES } from './blended-copy'

// Shared HTML escaper for every email template in the repo. Any user-supplied
// or DB-supplied value interpolated into an email body must go through this —
// unescaped interpolation turns confirmation/voucher/admin-alert emails into
// phishing vectors (see attacker-controlled name/className/message fields).
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// Google Workspace SMTP configuration - lazy initialization
let transporter: nodemailer.Transporter | null = null

function getTransporter() {
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

export async function sendEnrollmentConfirmation(
  to: string,
  enrollmentDetails: {
    name: string
    className: string
    date: string
    time: string
    location?: string
  }
) {
  const formattedDate = new Date(enrollmentDetails.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #DC2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        td { padding: 10px; border-bottom: 1px solid #ddd; }
        td:first-child { font-weight: bold; width: 30%; }
        .important { background-color: #fff3cd; padding: 15px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SaveYours Training Confirmation</h1>
        </div>
        <div class="content">
          <p>Dear ${escapeHtml(enrollmentDetails.name)},</p>
          <p>Thank you for registering for the following class:</p>

          <table>
            <tr>
              <td>Class:</td>
              <td>${escapeHtml(enrollmentDetails.className)}</td>
            </tr>
            <tr>
              <td>Date:</td>
              <td>${escapeHtml(formattedDate)}</td>
            </tr>
            <tr>
              <td>Time:</td>
              <td>${escapeHtml(enrollmentDetails.time)}</td>
            </tr>
            <tr>
              <td>Location:</td>
              <td>${escapeHtml(enrollmentDetails.location || '10800 Lyndale Ave S Suite 310, Bloomington, MN 55420')}</td>
            </tr>
          </table>
          
          <div class="important">
            <strong>IMPORTANT: Online Learning Required</strong><br>
            ${BLENDED_EXPLAINER_SENTENCES[0]} ${BLENDED_EXPLAINER_SENTENCES[1]}
            <br><br>
            Please allow up to 24 hours to receive this email. Check your spam folder if you don't see it.
          </div>
          
          <p><strong>What to Expect:</strong></p>
          <ul>
            <li>Complete online modules at your own pace (approximately 2 hours)</li>
            <li>Print or save your completion certificate</li>
            <li>Bring proof of completion to your in-person skills session</li>
            <li>Participate in hands-on practice with certified instructors</li>
          </ul>
          
          <div class="important">
            <strong>ATTENDANCE POLICY:</strong> Students must arrive ON-TIME for their scheduled in-person session. Failure to show up within 15 minutes of the scheduled in-person session will result in the forfeiture of your position in that class and your course fee.
          </div>

          <p><strong>Questions or Need to Reschedule?</strong><br>
          Please refer to our <a href="https://saveyours.net/policies" style="color: #DC2626; text-decoration: underline;">policies page</a> for information about cancellations, rescheduling, and refunds. If you need to cancel or reschedule, please email us at <a href="mailto:info@saveyours.net" style="color: #DC2626;">info@saveyours.net</a> at least 24 hours before your scheduled class.</p>
          
          <div class="footer">
            <p>Questions? Contact us at <a href="mailto:info@saveyours.net">info@saveyours.net</a></p>
            <p>SaveYours LLC | Bloomington, MN</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `

  const mailOptions = {
    from: '"SaveYours Training" <info@saveyours.net>',
    to,
    subject: 'Your Training Confirmation - SaveYours',
    html: htmlContent,
  }

  try {
    const info = await getTransporter().sendMail(mailOptions)
    console.log('Email sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Email error:', error)
    return { success: false, error }
  }
}

export async function sendStudentOtpEmail(to: string, code: string) {
  const safeCode = escapeHtml(code)
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #DC2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 6px; text-align: center; padding: 20px; background: #fff; border: 1px solid #ddd; border-radius: 5px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>SaveYours Verification</h1></div>
        <div class="content">
          <p>Enter this code on the sign-in page to view your enrollments:</p>
          <p class="code">${safeCode}</p>
          <p>This code expires in 10 minutes.</p>
          <p>If you didn&rsquo;t request this, you can safely ignore this email.</p>
          <div class="footer">
            <p>Questions? <a href="mailto:info@saveyours.net">info@saveyours.net</a></p>
            <p>SaveYours LLC | Bloomington, MN</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `

  const mailOptions = {
    from: '"SaveYours Training" <info@saveyours.net>',
    to,
    subject: 'Your SaveYours verification code',
    html: htmlContent,
  }

  try {
    const info = await getTransporter().sendMail(mailOptions)
    console.log('Student OTP email sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Student OTP email error:', error)
    return { success: false, error }
  }
}

export async function sendAdminAlert(
  subject: string,
  htmlContent: string
) {
  const mailOptions = {
    from: '"SaveYours Training" <info@saveyours.net>',
    to: 'info@saveyours.net',
    subject,
    html: htmlContent,
  }

  try {
    const info = await getTransporter().sendMail(mailOptions)
    console.log('Admin alert email sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Admin alert email error:', error)
    return { success: false, error }
  }
}

export async function sendRefundNotification(
  to: string,
  details: {
    name: string
    className: string
    date: string
    time: string
    amountRefunded: string
  }
) {
  const formattedDate = new Date(details.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #DC2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .notice { background-color: #fff3cd; padding: 15px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Class Full - Refund Issued</h1>
        </div>
        <div class="content">
          <p>Dear ${escapeHtml(details.name)},</p>
          <p>We're sorry, but the class you registered for has reached full capacity:</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr><td style="padding:10px;border-bottom:1px solid #ddd;font-weight:bold;width:30%;">Class:</td><td style="padding:10px;border-bottom:1px solid #ddd;">${escapeHtml(details.className)}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #ddd;font-weight:bold;">Date:</td><td style="padding:10px;border-bottom:1px solid #ddd;">${escapeHtml(formattedDate)}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #ddd;font-weight:bold;">Time:</td><td style="padding:10px;border-bottom:1px solid #ddd;">${escapeHtml(details.time)}</td></tr>
          </table>
          <div class="notice">
            <strong>A full refund of ${escapeHtml(details.amountRefunded)} has been issued to your original payment method.</strong>
            Please allow 5-10 business days for the refund to appear on your statement.
          </div>
          <p>We apologize for the inconvenience. Please visit <a href="https://saveyours.net/classes" style="color:#DC2626;">our website</a> to view other available class dates.</p>
          <p>If you have any questions, please contact us at <a href="mailto:info@saveyours.net" style="color:#DC2626;">info@saveyours.net</a>.</p>
          <div class="footer">
            <p>SaveYours LLC | Bloomington, MN</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `

  const mailOptions = {
    from: '"SaveYours Training" <info@saveyours.net>',
    to,
    subject: 'Class Full - Your Refund Has Been Processed - SaveYours',
    html: htmlContent,
  }

  try {
    const info = await getTransporter().sendMail(mailOptions)
    console.log('Refund notification email sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Refund notification email error:', error)
    return { success: false, error }
  }
}

export async function sendVoucherEmail(
  to: string,
  voucherDetails: {
    name: string
    className: string
    date: string
    time: string
    voucherUrl: string
  }
) {
  console.log('📧 [VOUCHER EMAIL] sendVoucherEmail called:', {
    to,
    name: voucherDetails.name,
    className: voucherDetails.className,
    date: voucherDetails.date,
    voucherUrlPreview: voucherDetails.voucherUrl?.substring(0, 50) + '...'
  });

  // Reject anything other than http(s). javascript: and data: URLs escape
  // through HTML escaping and would render as clickable in most mail clients.
  // A bad URL here means the admin uploaded a bogus voucher — the enrollment
  // itself still succeeds; the failure surfaces in the reconcile UI so the
  // admin can fix it manually.
  if (
    typeof voucherDetails.voucherUrl !== 'string' ||
    !/^https?:\/\//i.test(voucherDetails.voucherUrl)
  ) {
    console.error('[VOUCHER EMAIL] Refusing to send: voucherUrl is not http(s):', {
      to,
      className: voucherDetails.className,
      voucherUrlPreview: (voucherDetails.voucherUrl ?? '').toString().slice(0, 50),
    })
    return { success: false, error: 'invalid_voucher_url' as const }
  }

  const formattedDate = new Date(voucherDetails.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #DC2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .voucher-link { background-color: #DC2626; color: white; padding: 15px 25px; text-decoration: none; display: inline-block; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .details-box { background-color: #fff; padding: 15px; margin: 15px 0; border: 1px solid #ddd; border-radius: 5px; }
        .steps { background-color: #fff; padding: 15px; margin: 15px 0; border-left: 4px solid #DC2626; }
        .steps ol { margin: 0; padding-left: 20px; }
        .steps li { margin-bottom: 10px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Blended Course Information</h1>
        </div>
        <div class="content">
          <p>Hello ${escapeHtml(voucherDetails.name)},</p>

          <p>Thank you for choosing SaveYours for your certification needs. Please follow the directions below to register for the online portion of the American Red Cross ${escapeHtml(voucherDetails.className)} course.</p>

          <p>You must complete the online course content and present proof of completion in order to attend and participate in the in-person classroom course session(s) scheduled to meet on the following date(s), time(s) and location:</p>

          <div class="details-box">
            <p><strong>Date(s):</strong> ${escapeHtml(formattedDate)}</p>
            <p><strong>Time(s):</strong> ${escapeHtml(voucherDetails.time)}</p>
            <p><strong>Location:</strong> 10800 Lyndale Ave S Suite 310, Bloomington, MN 55420</p>
          </div>

          <p>There are two parking locations for this building, a parking lot directly behind the building and another parking lot across the adjacent street.</p>

          <p><strong>To register for and access the online portion of the course:</strong></p>

          <p style="text-align: center;">
            <a href="${escapeHtml(voucherDetails.voucherUrl)}" class="voucher-link" style="background-color: #DC2626; color: #FFFFFF; padding: 15px 25px; text-decoration: none; display: inline-block; border-radius: 5px; margin: 20px 0; font-weight: bold;">Access Your Online Course</a>
          </p>

          <div class="steps">
            <ol>
              <li>Click the registration link above</li>
              <li>Enter your information in the student details:
                <ul>
                  <li>Enter student first and last name (required)</li>
                  <li>Enter student email address (required)</li>
                  <li>Enter phone number</li>
                </ul>
              </li>
              <li>Note: If an Email Verification Confirmation message appears click "Return" and verify the email address entered is a valid email. Then click "Register" and "Login" and click "Proceed."</li>
              <li>Check your email account for an email from The American Red Cross. Click the link provided in the email and enter your Username (provided in the email) and password. If you already have an account in the Red Cross Learning Center, we recommend you use your existing Red Cross Learning Center password (If you do not see the email, check your junk/spam folders).</li>
              <li>Once in the Red Cross Learning Center, the class(es) you are taking will show on the Home page. Click the ${escapeHtml(voucherDetails.className)} course and click the launch button to get started. Digital course materials are available and in the Materials tab. You may also shop for and purchase materials and supplies by clicking the link on your Home page.</li>
            </ol>
          </div>

          <p>Should you have any questions, please email us at <a href="mailto:info@saveyours.net" style="color: #DC2626;">info@saveyours.net</a>. Thank you.</p>

          <div class="footer">
            <p>SaveYours LLC | Bloomington, MN</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `

  const mailOptions = {
    from: '"SaveYours Training" <info@saveyours.net>',
    to,
    subject: `Blended ${voucherDetails.className} course information`,
    html: htmlContent,
  }

  try {
    const info = await getTransporter().sendMail(mailOptions)
    console.log('Voucher email sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Voucher email error:', error)
    return { success: false, error }
  }
}
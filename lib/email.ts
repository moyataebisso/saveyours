import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT!),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

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
          <p>Dear ${enrollmentDetails.name},</p>
          <p>Thank you for registering for the following class:</p>
          
          <table>
            <tr>
              <td>Class:</td>
              <td>${enrollmentDetails.className}</td>
            </tr>
            <tr>
              <td>Date:</td>
              <td>${formattedDate}</td>
            </tr>
            <tr>
              <td>Time:</td>
              <td>${enrollmentDetails.time}</td>
            </tr>
            <tr>
              <td>Location:</td>
              <td>${enrollmentDetails.location || '5450 W 41st St, Minneapolis, MN 55416'}</td>
            </tr>
          </table>
          
          <div class="important">
            <strong>IMPORTANT: Online Learning Required</strong><br>
            This course requires online learning to be completed BEFORE the classroom portion. 
            You will receive a separate email within 24 hours with instructions to access the online course.
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
          
          <p><strong>Cancellation Policy:</strong><br>
          If you need to cancel or reschedule, please email us at info@saveyours.net at least 24 hours before your scheduled class.</p>
          
          <div class="footer">
            <p>Questions? Contact us at info@saveyours.net</p>
            <p>SaveYours LLC | Minneapolis, MN</p>
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
    const info = await transporter.sendMail(mailOptions)
    console.log('Email sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Email error:', error)
    return { success: false, error }
  }
}
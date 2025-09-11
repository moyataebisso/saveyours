interface EmailData {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(data: EmailData) {
  console.log('Mock email sent:', data);
  return { success: true };
}
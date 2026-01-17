// test-emails.ts
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { sendEnrollmentConfirmation, sendVoucherEmail } from './lib/email'

async function testAllEmails() {
  console.log('TESTING SAVEYOURS EMAIL SYSTEM')
  console.log('==================================\n')

  // Check environment variables
  console.log('Environment Check:')
  console.log(`   EMAIL_SERVICE: ${process.env.EMAIL_SERVICE || 'not set'}`)
  console.log(`   EMAIL_HOST: ${process.env.EMAIL_HOST || 'not set'}`)
  console.log(`   EMAIL_PORT: ${process.env.EMAIL_PORT || 'not set'}`)
  console.log(`   EMAIL_USER: ${process.env.EMAIL_USER || 'not set'}`)
  console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? 'Set (hidden)' : 'NOT SET'}`)
  console.log('')

  if (!process.env.EMAIL_PASS) {
    console.error('ERROR: EMAIL_PASS is not set!')
    console.log('Please add your Google App Password to .env.local')
    return
  }

  const testEmail = process.env.EMAIL_USER || 'info@saveyours.net' // Send to self for testing

  // Test 1: Enrollment Confirmation Email
  console.log('TEST 1: Enrollment Confirmation Email')
  console.log(`   Sending to: ${testEmail}`)
  const enrollmentResult = await sendEnrollmentConfirmation(testEmail, {
    name: 'Test Student',
    className: 'Blended Adult First Aid/CPR/AED-BL-r.21',
    date: '2025-02-01',
    time: '6:00 PM - 7:30 PM',
    location: '5450 W 41st St, Minneapolis, MN 55416'
  })
  console.log(`   Result: ${enrollmentResult.success ? 'SUCCESS' : 'FAILED'}`)
  if (!enrollmentResult.success) console.log(`   Error:`, enrollmentResult.error)
  console.log('')

  // Test 2: Voucher Email
  console.log('TEST 2: Voucher Email')
  console.log(`   Sending to: ${testEmail}`)
  const voucherResult = await sendVoucherEmail(testEmail, {
    name: 'Test Student',
    className: 'Blended Adult First Aid/CPR/AED-BL-r.21',
    date: '2025-02-01',
    time: '6:00 PM - 7:30 PM',
    voucherUrl: 'https://www.redcross.org/take-a-class/voucher/TEST-VOUCHER-12345'
  })
  console.log(`   Result: ${voucherResult.success ? 'SUCCESS' : 'FAILED'}`)
  if (!voucherResult.success) console.log(`   Error:`, voucherResult.error)
  console.log('')

  // Summary
  console.log('==================================')
  console.log('TEST SUMMARY')
  console.log(`   Enrollment Email: ${enrollmentResult.success ? 'PASSED' : 'FAILED'}`)
  console.log(`   Voucher Email: ${voucherResult.success ? 'PASSED' : 'FAILED'}`)
  console.log('')

  if (enrollmentResult.success && voucherResult.success) {
    console.log('ALL TESTS PASSED!')
    console.log(`Check inbox at ${testEmail} to verify emails arrived correctly.`)
    console.log('Also check spam folder just in case.')
  } else {
    console.log('SOME TESTS FAILED - Check errors above')
  }
}

testAllEmails().catch(console.error)

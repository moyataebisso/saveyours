import { NextRequest, NextResponse } from 'next/server'
import { supabaseHelpers } from '@/lib/supabase'
import { stripe } from '@/lib/stripe-server'  // Changed from '@/lib/stripe'
import { sendEnrollmentConfirmation, sendVoucherEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { 
      sessionId, 
      email, 
      name, 
      phone,
      paymentIntentId 
    } = await req.json()

    // Verify the payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment not confirmed' }, { status: 400 })
    }

    // Get session details
    const { data: session } = await supabaseHelpers.getSessionById(sessionId)
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Create enrollment in database
    const { data: enrollment, error } = await supabaseHelpers.createEnrollment({
      session_id: sessionId,
      guest_email: email,
      guest_name: name,
      amount_paid: paymentIntent.amount / 100,
      stripe_payment_intent_id: paymentIntent.id,
    })

    if (error) {
      console.error('Enrollment error:', error)
      return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 })
    }

    // Send confirmation email
    await sendEnrollmentConfirmation(email, {
      name,
      className: session.class.name,
      date: session.date,
      time: `${session.start_time} - ${session.end_time}`,
    })

    // Assign and send voucher
    console.log('🎟️ [ENROLLMENT] Starting voucher assignment for session:', sessionId)
    try {
      const { data: voucher, error: voucherError } = await supabaseHelpers.getAvailableVoucher(sessionId)

      console.log('🎟️ [ENROLLMENT] getAvailableVoucher returned:', {
        hasVoucher: !!voucher,
        voucherId: voucher?.id,
        voucherError
      })

      if (voucherError) {
        console.error('🎟️ [ENROLLMENT] Error getting available voucher:', voucherError)
      }

      if (voucher) {
        console.log('🎟️ [ENROLLMENT] Found voucher, attempting to assign:', voucher.id)
        const { data: assignedVoucher, error: assignError } = await supabaseHelpers.assignVoucher(voucher.id, email)

        console.log('🎟️ [ENROLLMENT] assignVoucher returned:', {
          success: !assignError,
          assignedVoucher: assignedVoucher?.id,
          assignError
        })

        if (!assignError) {
          console.log('🎟️ [ENROLLMENT] Voucher assigned, sending email...')
          const emailResult = await sendVoucherEmail(email, {
            name,
            className: session.class.name,
            date: session.date,
            time: `${session.start_time} - ${session.end_time}`,
            voucherUrl: voucher.voucher_url,
          })
          console.log('🎟️ [ENROLLMENT] Voucher email result:', emailResult)
          console.log(`✅ Voucher email sent to ${email} for session ${sessionId}`)
        } else {
          console.error('❌ [ENROLLMENT] Failed to assign voucher:', assignError)
        }
      } else {
        console.warn(`⚠️ [ENROLLMENT] No available voucher for session ${sessionId} - student ${email} will need manual voucher assignment`)
      }
    } catch (voucherError) {
      console.error('❌ [ENROLLMENT] Voucher assignment error (non-fatal):', voucherError)
      // Don't fail the enrollment if voucher assignment fails
    }

    return NextResponse.json({ success: true, enrollmentId: enrollment?.id })
  } catch (error) {
    console.error('Enrollment creation error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
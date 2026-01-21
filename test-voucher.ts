// test-voucher.ts
// Test script to debug voucher assignment issues
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// The session ID you're testing with
const TEST_SESSION_ID = '38db6130-693b-40f8-a0e3-a61d380cb0d3'

async function testVoucherFlow() {
  console.log('='.repeat(60))
  console.log('VOUCHER ASSIGNMENT DEBUG TEST')
  console.log('='.repeat(60))
  console.log('')

  // Step 1: Check environment
  console.log('1. ENVIRONMENT CHECK')
  console.log(`   SUPABASE_URL: ${supabaseUrl ? 'Set' : 'NOT SET'}`)
  console.log(`   SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'Set (hidden)' : 'NOT SET'}`)
  console.log('')

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('ERROR: Supabase credentials not set!')
    return
  }

  // Step 2: Check session exists
  console.log('2. CHECK SESSION EXISTS')
  console.log(`   Session ID: ${TEST_SESSION_ID}`)

  const { data: session, error: sessionError } = await supabase
    .from('class_sessions')
    .select('*, class:classes(*)')
    .eq('id', TEST_SESSION_ID)
    .single()

  if (sessionError) {
    console.error(`   ERROR: ${sessionError.message}`)
    console.error(`   Code: ${sessionError.code}`)
  } else if (session) {
    console.log(`   Found session: ${session.class?.name}`)
    console.log(`   Date: ${session.date}`)
    console.log(`   Status: ${session.status}`)
  } else {
    console.log('   Session NOT FOUND!')
  }
  console.log('')

  // Step 3: List ALL vouchers for this session
  console.log('3. ALL VOUCHERS FOR THIS SESSION')

  const { data: allVouchers, error: allError } = await supabase
    .from('voucher_links')
    .select('*')
    .eq('session_id', TEST_SESSION_ID)
    .order('created_at', { ascending: true })

  if (allError) {
    console.error(`   ERROR: ${allError.message}`)
    console.error(`   Code: ${allError.code}`)
    console.error(`   Details:`, allError)
  } else if (allVouchers && allVouchers.length > 0) {
    console.log(`   Total vouchers: ${allVouchers.length}`)
    console.log('')
    console.log('   Voucher Details:')
    allVouchers.forEach((v, i) => {
      console.log(`   [${i + 1}] ID: ${v.id}`)
      console.log(`       Status: ${v.status}`)
      console.log(`       Assigned to: ${v.assigned_to_email || 'Not assigned'}`)
      console.log(`       URL preview: ${v.voucher_url?.substring(0, 60)}...`)
      console.log('')
    })
  } else {
    console.log('   NO VOUCHERS FOUND FOR THIS SESSION!')
    console.log('')
    console.log('   POSSIBLE ISSUES:')
    console.log('   - Session ID might not match (check UUID format)')
    console.log('   - Vouchers might be in a different table')
    console.log('   - RLS policies might be blocking access')
  }
  console.log('')

  // Step 4: Count by status
  console.log('4. VOUCHER STATUS BREAKDOWN')
  if (allVouchers && allVouchers.length > 0) {
    const available = allVouchers.filter(v => v.status === 'available').length
    const assigned = allVouchers.filter(v => v.status === 'assigned').length
    const other = allVouchers.filter(v => !['available', 'assigned'].includes(v.status)).length

    console.log(`   Available: ${available}`)
    console.log(`   Assigned: ${assigned}`)
    if (other > 0) {
      console.log(`   Other statuses: ${other}`)
      const otherStatuses = [...new Set(allVouchers.filter(v => !['available', 'assigned'].includes(v.status)).map(v => v.status))]
      console.log(`   Other status values: ${otherStatuses.join(', ')}`)
    }
  }
  console.log('')

  // Step 5: Test getting available voucher
  console.log('5. TEST getAvailableVoucher QUERY')

  const { data: availableVoucher, error: availError } = await supabase
    .from('voucher_links')
    .select('*')
    .eq('session_id', TEST_SESSION_ID)
    .eq('status', 'available')
    .limit(1)

  if (availError) {
    console.error(`   ERROR: ${availError.message}`)
    console.error(`   Code: ${availError.code}`)
    console.error(`   Details:`, availError)
  } else if (availableVoucher && availableVoucher.length > 0) {
    console.log('   SUCCESS! Found available voucher:')
    console.log(`   ID: ${availableVoucher[0].id}`)
    console.log(`   URL: ${availableVoucher[0].voucher_url?.substring(0, 60)}...`)
  } else {
    console.log('   No available vouchers returned!')
  }
  console.log('')

  // Step 6: Test with .single() to see if that's the issue
  console.log('6. TEST WITH .single() (this might error if 0 or >1 rows)')

  const { data: singleVoucher, error: singleError } = await supabase
    .from('voucher_links')
    .select('*')
    .eq('session_id', TEST_SESSION_ID)
    .eq('status', 'available')
    .limit(1)
    .single()

  if (singleError) {
    console.log(`   Error (expected if 0 rows): ${singleError.message}`)
    console.log(`   Code: ${singleError.code}`)
    if (singleError.code === 'PGRST116') {
      console.log('   This error means 0 rows were found.')
    }
  } else if (singleVoucher) {
    console.log('   SUCCESS with .single()!')
    console.log(`   ID: ${singleVoucher.id}`)
  }
  console.log('')

  // Step 7: Check RLS policies by trying a raw count
  console.log('7. RLS / PERMISSION CHECK')

  const { count, error: countError } = await supabase
    .from('voucher_links')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', TEST_SESSION_ID)

  if (countError) {
    console.error(`   Count query ERROR: ${countError.message}`)
    console.log('   This might indicate RLS policy blocking access!')
  } else {
    console.log(`   Total rows visible: ${count}`)
    if (count === 0) {
      console.log('   WARNING: Count is 0 - either no vouchers or RLS is blocking')
    }
  }
  console.log('')

  // Step 8: List recent enrollments for this session
  console.log('8. RECENT ENROLLMENTS FOR THIS SESSION')

  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('id, guest_email, guest_name, enrolled_at, status')
    .eq('session_id', TEST_SESSION_ID)
    .order('enrolled_at', { ascending: false })
    .limit(5)

  if (enrollError) {
    console.error(`   ERROR: ${enrollError.message}`)
  } else if (enrollments && enrollments.length > 0) {
    console.log(`   Found ${enrollments.length} recent enrollments:`)
    enrollments.forEach((e, i) => {
      console.log(`   [${i + 1}] ${e.guest_name} (${e.guest_email})`)
      console.log(`       Enrolled: ${e.enrolled_at}`)
      console.log(`       Status: ${e.status}`)
    })
  } else {
    console.log('   No enrollments found for this session')
  }
  console.log('')

  // Summary
  console.log('='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))

  if (allVouchers && allVouchers.length > 0) {
    const available = allVouchers.filter(v => v.status === 'available').length
    if (available > 0) {
      console.log('Vouchers ARE available! The issue might be:')
      console.log('- Session ID mismatch in Stripe metadata')
      console.log('- Error in webhook that is being silently caught')
      console.log('- Check Vercel/server logs for the detailed console.log output')
    } else {
      console.log('All vouchers are already assigned!')
    }
  } else {
    console.log('NO vouchers exist for this session!')
    console.log('You need to add vouchers via the admin panel.')
  }
}

// Run the test
testVoucherFlow()
  .catch(console.error)
  .finally(() => process.exit())

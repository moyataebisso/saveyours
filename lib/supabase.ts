import { createClient } from '@supabase/supabase-js'
import type {
  ClassSession,
  ClassSessionWithClass,
  EnrollmentData,
  InquiryData,
  SessionData,
  Enrollment,
  VoucherLink
} from '@/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database helper functions
export const supabaseHelpers = {
  // Get all available class sessions with class details
  async getAvailableSessions() {
    const { data, error } = await supabase
      .from('class_sessions')
      .select(`
        *,
        class:classes(*)
      `)
      .eq('status', 'scheduled')
      .order('date', { ascending: true })
    
    if (error) {
      console.error('Error fetching sessions:', error);
    }
    
    console.log('Query returned:', data?.length, 'sessions');
    
    return { data: data as ClassSessionWithClass[] | null, error }
  },

  // Get single session details
  async getSessionById(sessionId: string) {
    const { data, error } = await supabase
      .from('class_sessions')
      .select(`
        *,
        class:classes(*)
      `)
      .eq('id', sessionId)
      .single()
    
    return { data: data as ClassSessionWithClass | null, error }
  },

  // Create enrollment (for guest checkout)
  async createEnrollment(enrollmentData: EnrollmentData) {
    // First, increment the enrollment count
    const { data: session } = await supabase
      .from('class_sessions')
      .select('current_enrollment, max_capacity')
      .eq('id', enrollmentData.session_id)
      .single()

    if (session) {
      const newEnrollment = session.current_enrollment + 1;
      
      // Update enrollment count
      await supabase
        .from('class_sessions')
        .update({ 
          current_enrollment: newEnrollment,
          status: newEnrollment >= session.max_capacity ? 'full' : 'scheduled'
        })
        .eq('id', enrollmentData.session_id)
    }

    // Create the enrollment
    const { data, error } = await supabase
      .from('enrollments')
      .insert([{
        ...enrollmentData,
        status: 'confirmed',
        payment_status: 'paid',
        enrolled_at: new Date().toISOString()
      }])
      .select()
      .single()
    
    return { data: data as Enrollment | null, error }
  },

  // Submit contact form inquiry
  async submitInquiry(inquiryData: InquiryData) {
    const { data, error } = await supabase
      .from('inquiries')
      .insert([inquiryData])
      .select()
      .single()
    
    return { data, error }
  },

  // Admin: Get all enrollments
  async getAllEnrollments() {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        session:class_sessions(
          *,
          class:classes(*)
        )
      `)
      .order('enrolled_at', { ascending: false })
    
    return { data: data as Enrollment[] | null, error }
  },

  // Admin: Create new class session - FIXED DATE HANDLING
  async createClassSession(sessionData: SessionData) {
    console.log('📅 Creating session with date:', sessionData.date);
    
    // Ensure date is in YYYY-MM-DD format without timezone conversion
    // This prevents the "day before" bug
    const dateOnly = sessionData.date.split('T')[0];
    console.log('📅 Date formatted as:', dateOnly);
    
    const { data, error } = await supabase
      .from('class_sessions')
      .insert([{
        ...sessionData,
        date: dateOnly, // Use date-only format
        status: sessionData.status || 'scheduled',
        current_enrollment: 0
      }])
      .select()
      .single()
    
    if (error) {
      console.error('❌ Error creating session:', error);
    } else {
      console.log('✅ Session created with date:', data?.date);
    }
    
    return { data: data as ClassSession | null, error }
  },

  // Admin: Update class session - FIXED DATE HANDLING
  async updateClassSession(sessionId: string, updates: Partial<SessionData>) {
    console.log('📅 Updating session with:', updates);
    
    // If date is being updated, ensure proper format
    if (updates.date) {
      updates.date = updates.date.split('T')[0];
      console.log('📅 Date formatted as:', updates.date);
    }
    
    const { data, error } = await supabase
      .from('class_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single()
    
    if (error) {
      console.error('❌ Error updating session:', error);
    } else {
      console.log('✅ Session updated');
    }
    
    return { data: data as ClassSession | null, error }
  },

  // Admin: Cancel class session
  async cancelClassSession(sessionId: string) {
    console.log('Cancelling session:', sessionId);
    
    try {
      const { data, error } = await supabase
        .from('class_sessions')
        .update({ 
          status: 'cancelled'
        })
        .eq('id', sessionId)
        .select();
      
      if (error) {
        console.error('Error cancelling session:', error);
        return { data: null, error };
      }
      
      if (data && data.length > 0) {
        console.log('Session cancelled successfully:', data[0]);
        
        // Update related enrollments
        await supabase
          .from('enrollments')
          .update({ 
            status: 'cancelled'
          })
          .eq('session_id', sessionId);
        
        return { data: data[0], error: null };
      } else {
        console.error('No session found with id:', sessionId);
        return { 
          data: null, 
          error: { message: 'Session not found', code: 'NOT_FOUND' } 
        };
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      return { 
        data: null, 
        error: { message: 'Unexpected error occurred', code: 'UNKNOWN' } 
      };
    }
  },

  // Admin: Restore cancelled enrollment - NEW FEATURE
  async restoreEnrollment(enrollmentId: string, sessionId: string) {
    console.log('🔄 Restoring enrollment:', enrollmentId);
    
    // First, check if session is still available
    const { data: session } = await supabase
      .from('class_sessions')
      .select('current_enrollment, max_capacity, status')
      .eq('id', sessionId)
      .single();

    if (!session) {
      console.error('❌ Session not found');
      return { data: null, error: { message: 'Session not found' } };
    }

    if (session.status === 'cancelled') {
      console.error('❌ Session is cancelled');
      return { data: null, error: { message: 'Cannot restore - session is cancelled' } };
    }

    if (session.current_enrollment >= session.max_capacity) {
      console.error('❌ Session is full');
      return { data: null, error: { message: 'Cannot restore - session is full' } };
    }

    // Restore the enrollment
    const { data, error } = await supabase
      .from('enrollments')
      .update({ 
        status: 'confirmed'
      })
      .eq('id', enrollmentId)
      .select();

    if (!error && data) {
      console.log('✅ Enrollment restored');
      
      // Increment session enrollment count
      const newEnrollment = session.current_enrollment + 1;
      await supabase
        .from('class_sessions')
        .update({ 
          current_enrollment: newEnrollment,
          status: newEnrollment >= session.max_capacity ? 'full' : 'scheduled'
        })
        .eq('id', sessionId);
      
      console.log('✅ Session enrollment count updated');
    } else {
      console.error('❌ Error restoring enrollment:', error);
    }

    return { data: data && data[0], error };
  },

  // Get user enrollments
  async getUserEnrollments(email: string) {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        session:class_sessions(
          *,
          class:classes(*)
        )
      `)
      .eq('guest_email', email)
      .order('enrolled_at', { ascending: false })
    
    return { data: data as Enrollment[] | null, error }
  },

  // Admin: Get all inquiries
  async getInquiries() {
    const { data, error } = await supabase
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false })
    
    return { data, error }
  },

  // Admin: Update inquiry status
  async updateInquiryStatus(inquiryId: string, status: 'new' | 'contacted' | 'resolved') {
    console.log('=== SUPABASE HELPER: updateInquiryStatus ===');
    console.log('Inquiry ID:', inquiryId);
    console.log('New Status:', status);

    const { data, error } = await supabase
      .from('inquiries')
      .update({ status })
      .eq('id', inquiryId)
      .select()

    console.log('Database update result:', { data, error });

    return { data, error }
  },

  // Voucher Management Functions

  // Get the next available voucher for a session
  async getAvailableVoucher(sessionId: string) {
    const { data, error } = await supabase
      .from('voucher_links')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'available')
      .limit(1)
      .single()

    return { data: data as VoucherLink | null, error }
  },

  // Assign a voucher to an email
  async assignVoucher(voucherId: string, email: string) {
    const { data, error } = await supabase
      .from('voucher_links')
      .update({
        status: 'assigned',
        assigned_to_email: email,
        assigned_at: new Date().toISOString()
      })
      .eq('id', voucherId)
      .select()
      .single()

    return { data: data as VoucherLink | null, error }
  },

  // Bulk add vouchers for a session
  async addVouchers(sessionId: string, urls: string[]) {
    const vouchers = urls.map(url => ({
      session_id: sessionId,
      voucher_url: url.trim(),
      status: 'available' as const
    }))

    const { data, error } = await supabase
      .from('voucher_links')
      .insert(vouchers)
      .select()

    return { data: data as VoucherLink[] | null, error }
  },

  // Get all vouchers for a session
  async getVouchersForSession(sessionId: string) {
    const { data, error } = await supabase
      .from('voucher_links')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    return { data: data as VoucherLink[] | null, error }
  },

  // Get voucher stats for a session
  async getVoucherStats(sessionId: string) {
    const { data, error } = await supabase
      .from('voucher_links')
      .select('status')
      .eq('session_id', sessionId)

    if (error || !data) {
      return { available: 0, assigned: 0, total: 0 }
    }

    const available = data.filter(v => v.status === 'available').length
    const assigned = data.filter(v => v.status === 'assigned').length

    return { available, assigned, total: data.length }
  },

  // Delete a single voucher
  async deleteVoucher(voucherId: string) {
    const { error } = await supabase
      .from('voucher_links')
      .delete()
      .eq('id', voucherId)

    return { error }
  },

  // Delete multiple vouchers
  async deleteVouchers(voucherIds: string[]) {
    const { error } = await supabase
      .from('voucher_links')
      .delete()
      .in('id', voucherIds)

    return { error }
  },

  // Update a voucher
  async updateVoucher(voucherId: string, updates: {
    voucher_url?: string;
    status?: 'available' | 'assigned';
    assigned_to_email?: string | null;
    assigned_at?: string | null;
  }) {
    const { data, error } = await supabase
      .from('voucher_links')
      .update(updates)
      .eq('id', voucherId)
      .select()
      .single()

    return { data: data as VoucherLink | null, error }
  }
}
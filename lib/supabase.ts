import { createClient } from '@supabase/supabase-js'
import type { 
  ClassSession, 
  ClassSessionWithClass, 
  EnrollmentData, 
  InquiryData, 
  SessionData, 
  Enrollment 
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
    // .gte('date', new Date().toISOString().split('T')[0])  // Comment this out
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

  // Admin: Create new class session
  async createClassSession(sessionData: SessionData) {
    const { data, error } = await supabase
      .from('class_sessions')
      .insert([{
        ...sessionData,
        status: sessionData.status || 'scheduled',
        current_enrollment: 0
      }])
      .select()
      .single()
    
    return { data: data as ClassSession | null, error }
  },

  // Admin: Update class session
  async updateClassSession(sessionId: string, updates: Partial<SessionData>) {
    const { data, error } = await supabase
      .from('class_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single()
    
    return { data: data as ClassSession | null, error }
  },

  // Admin: Cancel class session
  async cancelClassSession(sessionId: string) {
    const { data, error } = await supabase
      .from('class_sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId)
    
    return { data, error }
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
    const { data, error } = await supabase
      .from('inquiries')
      .update({ status })
      .eq('id', inquiryId)
    
    return { data, error }
  }
}
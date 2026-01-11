// types/index.ts

export interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  role: 'student' | 'admin';
  created_at: string;
}

export interface Class {
  id: string;
  name: string;
  type: 'BLS' | 'CPR_AED' | 'First Aid';
  audience: 'healthcare' | 'general';
  price: number;
  duration_online: number;
  duration_skills: number;
  description: string;
  created_at: string;
}

export interface ClassSession {
  id: string;
  class_id: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  max_capacity: number;
  current_enrollment: number;
  status: 'scheduled' | 'full' | 'cancelled';
  created_at: string;
  class?: Class;
}

export interface Enrollment {
  id: string;
  user_id?: string;
  guest_email?: string;
  guest_name?: string;
  session_id: string;
  enrolled_at: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'refunded';
  stripe_payment_id?: string;
  stripe_payment_intent_id?: string;
  amount_paid?: number;
  certification_expires?: string;
  completed_at?: string;
  online_course_completed?: boolean;
  group_booking_id?: string;
  is_group_leader?: boolean;
  session?: ClassSession;
  user?: User;
}

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  service_type?: string;
  location?: string;
  participants?: number;
  preferred_dates?: string;
  message?: string;
  status: 'new' | 'contacted' | 'resolved';
  created_at: string;
}

export interface CartItem {
  id: string;
  user_id?: string;
  session_id: string;
  added_at: string;
  session?: ClassSession;
}

// Helper types for creating data
export interface ClassSessionWithClass extends ClassSession {
  class: Class;
}

export interface EnrollmentData {
  session_id: string;
  guest_email: string;
  guest_name: string;
  amount_paid: number;
  stripe_payment_intent_id: string;
}

export interface InquiryData {
  name: string;
  email: string;
  phone?: string;
  service_type?: string;
  location?: string;
  participants?: number;
  preferred_dates?: string;
  message?: string;
}

export interface SessionData {
  class_id: string;
  date: string;
  start_time: string;
  end_time: string;
  location?: string;
  max_capacity?: number;
  status?: 'scheduled' | 'full' | 'cancelled';
}

export interface VoucherLink {
  id: string;
  session_id: string;
  voucher_url: string;
  status: 'available' | 'assigned';
  assigned_to_email?: string;
  assigned_at?: string;
  created_at: string;
}
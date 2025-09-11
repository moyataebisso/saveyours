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
  type: 'BLS' | 'CPR/AED' | 'First Aid';
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
  status: 'open' | 'full' | 'cancelled';
  created_at: string;
  class?: Class;
}

export interface Enrollment {
  id: string;
  user_id: string;
  session_id: string;
  enrolled_at: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'refunded';
  stripe_payment_id?: string;
  amount_paid?: number;
  certification_expires?: string;
  completed_at?: string;
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
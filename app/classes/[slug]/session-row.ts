// Shape used for the upcoming-dates list on /classes/[slug]. Kept in a
// server-safe file so both the server page (which fetches from Supabase)
// and the client component (which renders the list) can import it without
// pulling the 'use client' boundary into a server module.

export interface SessionRow {
  id: string;
  class_id: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  max_capacity: number;
  current_enrollment: number;
  status: string;
  class?: {
    id: string;
    name: string;
    type: string;
    audience: string;
    price: number;
    duration_online: number;
    duration_skills: number;
    description: string;
  };
}

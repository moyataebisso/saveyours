interface MockSession {
  id: string;
  class_id: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  max_capacity: number;
  current_enrollment: number;
  status: string;
  class: {
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

interface InquiryData {
  name: string;
  email: string;
  phone?: string;
  service_type?: string;
  location?: string;
  participants?: number;
  preferred_dates?: string;
  message: string;
}

export const createClientBrowser = () => {
  return {
    from: (table: string) => ({
      select: () => Promise.resolve({ data: getMockData(table), error: null }),
      insert: () => Promise.resolve({ data: {}, error: null }),
      delete: () => Promise.resolve({ error: null }),
    })
  };
};

export const createClientServer = () => createClientBrowser();

const getMockData = (table: string): MockSession[] => {
  if (table === 'class_sessions') {
    return [
      {
        id: '1',
        class_id: 'class-1',
        date: '2025-09-20',
        start_time: '09:00 AM',
        end_time: '12:00 PM',
        location: '5450 W 41st St, Minneapolis, MN 55416',
        max_capacity: 12,
        current_enrollment: 5,
        status: 'open',
        class: {
          id: 'class-1',
          name: 'Basic Life Support-BL r.21',
          type: 'BLS',
          audience: 'healthcare',
          price: 75,
          duration_online: 120,
          duration_skills: 60,
          description: 'BLS certification for healthcare providers'
        }
      },
      {
        id: '2',
        class_id: 'class-2',
        date: '2025-09-25',
        start_time: '01:00 PM',
        end_time: '04:00 PM',
        location: '5450 W 41st St, Minneapolis, MN 55416',
        max_capacity: 12,
        current_enrollment: 3,
        status: 'open',
        class: {
          id: 'class-2',
          name: 'Adult and Pediatric First Aid/CPR/AED-BL-r.21',
          type: 'CPR/AED',
          audience: 'general',
          price: 95,
          duration_online: 120,
          duration_skills: 60,
          description: 'CPR and AED training for non-healthcare workers'
        }
      },
      {
        id: '3',
        class_id: 'class-1',
        date: '2025-10-02',
        start_time: '09:00 AM',
        end_time: '12:00 PM',
        location: '5450 W 41st St, Minneapolis, MN 55416',
        max_capacity: 12,
        current_enrollment: 8,
        status: 'open',
        class: {
          id: 'class-1',
          name: 'Basic Life Support-BL r.21',
          type: 'BLS',
          audience: 'healthcare',
          price: 75,
          duration_online: 120,
          duration_skills: 60,
          description: 'BLS certification for healthcare providers'
        }
      },
      {
        id: '4',
        class_id: 'class-2',
        date: '2025-10-05',
        start_time: '10:00 AM',
        end_time: '01:00 PM',
        location: '5450 W 41st St, Minneapolis, MN 55416',
        max_capacity: 12,
        current_enrollment: 12,
        status: 'full',
        class: {
          id: 'class-2',
          name: 'Adult and Pediatric First Aid/CPR/AED-BL-r.21',
          type: 'CPR/AED',
          audience: 'general',
          price: 95,
          duration_online: 120,
          duration_skills: 60,
          description: 'CPR and AED training for non-healthcare workers'
        }
      }
    ];
  }
  return [];
};

export const supabaseHelpers = {
  async getAvailableSessions() {
    return { data: getMockData('class_sessions'), error: null };
  },
  
  async submitInquiry(data: InquiryData) {
    console.log('Mock inquiry submitted:', data);
    return { data: { id: '1', ...data }, error: null };
  }
};

export default createClientBrowser();
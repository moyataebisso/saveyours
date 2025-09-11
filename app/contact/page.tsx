'use client';

import { useState } from 'react';
import { Mail, MapPin, Send, Users, Building } from 'lucide-react';
import { toast } from '@/components/ui/Toaster';
import { supabaseHelpers } from '@/lib/supabase';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service_type: '',
    location: '',
    participants: '',
    preferred_dates: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabaseHelpers.submitInquiry({
      ...formData,
      participants: formData.participants ? parseInt(formData.participants) : undefined,
    });

    if (error) {
      toast.error('Failed to send message. Please try again.');
    } else {
      toast.success('Message sent successfully! We\'ll get back to you soon.');
      setFormData({
        name: '',
        email: '',
        phone: '',
        service_type: '',
        location: '',
        participants: '',
        preferred_dates: '',
        message: ''
      });
    }
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-gradient-to-br from-primary-50 to-beige-50 py-16">
        <div className="container-custom">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 text-center">Get in Touch</h1>
          <p className="text-xl text-gray-600 text-center max-w-3xl mx-auto">
            Ready to schedule training for your team or have questions about our courses? 
            We are here to help!
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container-custom">
          <div className="grid lg:grid-cols-3 gap-12">
            <div className="lg:col-span-1">
              <div className="card p-6 mb-6">
                <h2 className="text-2xl font-bold mb-6">Contact Information</h2>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Mail className="w-5 h-5 text-primary-600 mt-1" />
                    <div>
                      <p className="font-medium">Email</p>
                      <a href="mailto:info@saveyours.net" className="text-gray-600 hover:text-primary-600">
                        info@saveyours.net
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 text-primary-600 mt-1" />
                    <div>
                      <p className="font-medium">Service Area</p>
                      <p className="text-gray-600">
                        Minneapolis Metropolitan Area<br />
                        5450 W 41st St<br />
                        Minneapolis, MN 55416
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="font-semibold mb-4">Mobile Training Available</h3>
                <p className="text-gray-600 text-sm mb-4">
                  We bring our training to your location! Perfect for:
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <Building className="w-4 h-4 mr-2 text-primary-600" />
                    Corporate offices
                  </li>
                  <li className="flex items-center">
                    <Users className="w-4 h-4 mr-2 text-primary-600" />
                    Community groups
                  </li>
                </ul>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="card p-8">
                <h2 className="text-2xl font-bold mb-6">Request a Quote</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="label">Name *</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="input"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="label">Email *</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="input"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="label">Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="input"
                      />
                    </div>
                    
                    <div>
                      <label className="label">Service Type</label>
                      <select
                        name="service_type"
                        value={formData.service_type}
                        onChange={handleChange}
                        className="input"
                      >
                        <option value="">Select a service</option>
                        <option value="BLS">Basic Life Support (BLS)</option>
                        <option value="CPR/AED">CPR/AED Training</option>
                        <option value="Mobile Training">Mobile/On-site Training</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="label">Location (for mobile service)</label>
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        className="input"
                        placeholder="City or address"
                      />
                    </div>
                    
                    <div>
                      <label className="label">Number of Participants</label>
                      <input
                        type="number"
                        name="participants"
                        value={formData.participants}
                        onChange={handleChange}
                        className="input"
                        min="1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Preferred Dates</label>
                    <input
                      type="text"
                      name="preferred_dates"
                      value={formData.preferred_dates}
                      onChange={handleChange}
                      className="input"
                      placeholder="e.g., Weekends in March"
                    />
                  </div>

                  <div>
                    <label className="label">Message *</label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      className="input min-h-[120px]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full md:w-auto"
                  >
                    {loading ? (
                      <>
                        <div className="spinner w-4 h-4 mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Send Message
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
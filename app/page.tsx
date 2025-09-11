import Link from 'next/link';
import { Heart, Zap, Home, Target, Award, Users, MapPin, GraduationCap, Activity } from 'lucide-react';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-50 via-beige-50 to-white py-20 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-100 rounded-full blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-beige-200 rounded-full blur-3xl opacity-20 animate-pulse"></div>
        
        <div className="container-custom relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 animate-fade-in-up">
              A helping hand can be a{' '}
              <span className="text-primary-600 relative inline-block">
                saving hand
                <span className="absolute bottom-0 left-0 w-full h-1 bg-primary-600 animate-expand"></span>
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed animate-fade-in-up">
              To empower individuals and organizations with the confidence and skills to act 
              decisively in emergencies through accessible, hands-on CPR and first aid training, 
              because every moment matters.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up">
              <Link href="/classes" className="btn btn-primary">
                <Heart className="w-5 h-5 mr-2" />
                View Classes
              </Link>
              <Link href="/contact" className="btn btn-secondary">
                <MapPin className="w-5 h-5 mr-2" />
                Get a Quote
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-white">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Our Training Services
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Professional certification courses designed for healthcare workers and the general public
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group card">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-600 to-primary-800 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
              <div className="p-8">
                <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Heart className="w-10 h-10 text-primary-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Basic Life Support</h3>
                <p className="text-gray-500 text-sm mb-4">For Healthcare Professionals</p>
                <div className="text-4xl font-bold text-primary-600 mb-4">$75</div>
                <p className="text-gray-600 mb-6">
                  BLS certification for healthcare providers. Learn critical life-saving skills 
                  including high-quality CPR and AED use.
                </p>
                <Link href="/classes" className="text-primary-600 font-semibold inline-flex items-center hover:gap-3 gap-2 transition-all">
                  Learn More 
                  <span>→</span>
                </Link>
              </div>
            </div>

            <div className="group card">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-600 to-primary-800 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
              <div className="p-8">
                <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Zap className="w-10 h-10 text-primary-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">CPR/AED Training</h3>
                <p className="text-gray-500 text-sm mb-4">For Non-Healthcare Workers</p>
                <div className="text-4xl font-bold text-primary-600 mb-4">$95</div>
                <p className="text-gray-600 mb-6">
                  Comprehensive CPR and AED training for the general public. Be prepared to 
                  save lives in emergency situations.
                </p>
                <Link href="/classes" className="text-primary-600 font-semibold inline-flex items-center hover:gap-3 gap-2 transition-all">
                  Learn More 
                  <span>→</span>
                </Link>
              </div>
            </div>

            <div className="group card">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-600 to-primary-800 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
              <div className="p-8">
                <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Home className="w-10 h-10 text-primary-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Mobile Training</h3>
                <p className="text-gray-500 text-sm mb-4">We Come to You</p>
                <div className="text-4xl font-bold text-primary-600 mb-4">Custom</div>
                <p className="text-gray-600 mb-6">
                  On-site training for businesses, organizations, and groups. Convenient and 
                  tailored to your needs.
                </p>
                <Link href="/contact" className="text-primary-600 font-semibold inline-flex items-center hover:gap-3 gap-2 transition-all">
                  Get Quote 
                  <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Choose SaveYours?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We combine online learning with hands-on practice for comprehensive training
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-white rounded-xl shadow-md flex items-center justify-center">
                <Target className="w-7 h-7 text-primary-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Blended Learning</h3>
                <p className="text-gray-600">
                  Complete online modules at your pace, then attend in-person skills verification
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-white rounded-xl shadow-md flex items-center justify-center">
                <Award className="w-7 h-7 text-primary-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Certified Training</h3>
                <p className="text-gray-600">
                  Red Cross certified provider meeting national, state, and OSHA requirements
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-white rounded-xl shadow-md flex items-center justify-center">
                <Users className="w-7 h-7 text-primary-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Small Class Sizes</h3>
                <p className="text-gray-600">
                  Maximum 12 students per session for personalized attention
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-white rounded-xl shadow-md flex items-center justify-center">
                <MapPin className="w-7 h-7 text-primary-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Mobile Service</h3>
                <p className="text-gray-600">
                  Training at your location for businesses and groups
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-white rounded-xl shadow-md flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-primary-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">2-Year Certification</h3>
                <p className="text-gray-600">
                  All certifications valid for 2 years with reminder notifications
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-white rounded-xl shadow-md flex items-center justify-center">
                <Activity className="w-7 h-7 text-primary-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Hands-On Practice</h3>
                <p className="text-gray-600">
                  Practice on professional training mannequins with expert guidance
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="container-custom text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Save Lives?
          </h2>
          <p className="text-xl mb-8 opacity-95 max-w-2xl mx-auto">
            Join our next training session and gain the confidence to respond in emergencies
          </p>
          <Link href="/classes" className="btn bg-white text-primary-600 hover:bg-gray-100">
            Browse Classes
          </Link>
        </div>
      </section>
    </>
  );
}
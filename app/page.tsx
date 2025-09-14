import Link from 'next/link';
import Image from 'next/image';
import { Heart, Zap, Home, Target, Award, Users, MapPin, GraduationCap, Activity, CheckCircle, Clock, Play } from 'lucide-react';

export default function HomePage() {
  return (
    <>
      {/* Hero Section - Enhanced with image */}
      <section className="relative bg-gradient-to-br from-primary-50 via-beige-50 to-white py-20 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-100 rounded-full blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-beige-200 rounded-full blur-3xl opacity-20 animate-pulse"></div>
        
        <div className="container-custom relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="max-w-2xl">
              {/* New: Enrollment Badge */}
              <div className="inline-flex items-center bg-white/80 backdrop-blur px-4 py-2 rounded-full mb-6">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>
                <span className="text-sm font-medium text-gray-700">Now Enrolling for Winter Classes</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 animate-fade-in-up">
                A helping hand can be a{' '}
                <span className="text-primary-600 relative inline-block">
                  saving hand
                  <span className="absolute bottom-0 left-0 w-full h-1 bg-primary-600 animate-expand"></span>
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed animate-fade-in-up">
                To empower individuals and organizations with the confidence and skills to act 
                decisively in emergencies through accessible, hands-on CPR and first aid training, 
                because every moment matters.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up mb-8">
                <Link href="/classes" className="btn btn-primary">
                  <Heart className="w-5 h-5 mr-2" />
                  View Classes
                </Link>
                <Link href="/contact" className="btn btn-secondary">
                  <MapPin className="w-5 h-5 mr-2" />
                  Get a Quote
                </Link>
              </div>

              {/* New: Trust Indicators */}
              <div className="flex items-center gap-6 text-sm text-gray-600 animate-fade-in-up">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Red Cross Certified</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span>500+ Lives Trained</span>
                </div>
              </div>
            </div>

            {/* New: Hero Image */}
            <div className="relative animate-fade-in-up">
              <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-primary-100 to-primary-50">
                {/* Replace with actual image */}
                <div className="aspect-[4/3] relative">
                  <Image 
                    src="/images/hero-cpr-training.png" 
                    alt="CPR Training in Action"
                    fill
                    className="object-cover"
                    priority
                    placeholder="blur"
                    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
                  />
                  {/* Overlay with play button */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-6">
                    <div className="flex items-center gap-3 text-white">
                      <Play className="w-10 h-10 bg-white/20 backdrop-blur rounded-full p-2" />
                      <div>
                        <p className="font-semibold">Watch: How CPR Saves Lives</p>
                        <p className="text-sm opacity-90">2 min video</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Decorative background element */}
              <div className="absolute -z-10 top-8 -right-8 w-full h-full bg-primary-200/30 rounded-2xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* New: Statistics Bar */}
      <section className="py-12 bg-white border-b">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-primary-600 mb-1">2,500+</div>
              <div className="text-sm text-gray-600">Lives Impacted</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-600 mb-1">98%</div>
              <div className="text-sm text-gray-600">Pass Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-600 mb-1">2 Years</div>
              <div className="text-sm text-gray-600">Certification Valid</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-600 mb-1">12 Max</div>
              <div className="text-sm text-gray-600">Class Size</div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section - Enhanced with images */}
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
            {/* BLS Card with Image */}
            <div className="group card overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-600 to-primary-800 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
              
              {/* New: Service Image */}
              <div className="relative h-48 -mx-6 -mt-6 mb-6">
                <Image 
                  src="/images/bls-training.png"
                  alt="BLS Training for Healthcare"
                  fill
                  className="object-cover"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
                />
                <div className="absolute top-4 left-4 bg-primary-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  Healthcare Pro
                </div>
              </div>

              <div className="px-6 pb-6">
                <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Heart className="w-8 h-8 text-primary-600" />
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

            {/* CPR/AED Card with Image */}
            <div className="group card overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-600 to-primary-800 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
              
              {/* New: Service Image */}
              <div className="relative h-48 -mx-6 -mt-6 mb-6">
                <Image 
                  src="/images/cpr-aed-training.png"
                  alt="CPR/AED Training"
                  fill
                  className="object-cover"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
                />
                <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  General Public
                </div>
              </div>

              <div className="px-6 pb-6">
                <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Zap className="w-8 h-8 text-primary-600" />
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

            {/* Mobile Training Card with Image */}
            <div className="group card overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-600 to-primary-800 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
              
              {/* New: Service Image */}
              <div className="relative h-48 -mx-6 -mt-6 mb-6">
                <Image 
                  src="/images/mobile-training.png"
                  alt="Mobile Training Service"
                  fill
                  className="object-cover"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
                />
                <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  We Come to You
                </div>
              </div>

              <div className="px-6 pb-6">
                <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Home className="w-8 h-8 text-primary-600" />
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

      {/* New: Visual Process Section */}
      <section className="py-20 bg-beige-50">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Your Path to Certification
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Simple 4-step process to get certified
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-primary-600">1</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Register Online</h3>
              <p className="text-gray-600 text-sm">Choose your class and complete registration</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-primary-600">2</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Online Learning</h3>
              <p className="text-gray-600 text-sm">Complete modules at your own pace</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-primary-600">3</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Hands-On Practice</h3>
              <p className="text-gray-600 text-sm">Demonstrate skills with expert guidance</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Get Certified</h3>
              <p className="text-gray-600 text-sm">Receive your 2-year certification</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Enhanced */}
      <section className="py-20 bg-gray-50">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Features */}
            <div>
              <div className="text-center lg:text-left mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  Why Choose SaveYours?
                </h2>
                <p className="text-lg text-gray-600">
                  We combine online learning with hands-on practice for comprehensive training
                </p>
              </div>

              <div className="space-y-6">
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

            {/* Right: Image Gallery */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="relative h-48 rounded-lg overflow-hidden shadow-lg">
                  <Image 
                    src="/images/students-practicing.png"
                    alt="Students practicing CPR"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative h-64 rounded-lg overflow-hidden shadow-lg">
                  <Image 
                    src="/images/group-training.png"
                    alt="Group training session"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="space-y-4 mt-8">
                <div className="relative h-64 rounded-lg overflow-hidden shadow-lg">
                  <Image 
                    src="/images/instructor-teaching.png"
                    alt="Instructor demonstration"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative h-48 rounded-lg overflow-hidden shadow-lg">
                  <Image 
                    src="/images/certification.png"
                    alt="Certification ceremony"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Enhanced with background */}
      <section className="relative py-20 bg-gradient-to-r from-primary-600 to-primary-800 text-white overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        
        <div className="container-custom text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Save Lives?
          </h2>
          <p className="text-xl mb-8 opacity-95 max-w-2xl mx-auto">
            Join our next training session and gain the confidence to respond in emergencies
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/classes" className="btn bg-white text-primary-600 hover:bg-gray-100">
              Browse Classes
            </Link>
            <Link href="/contact" className="btn bg-transparent border-2 border-white text-white hover:bg-white hover:text-primary-600">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
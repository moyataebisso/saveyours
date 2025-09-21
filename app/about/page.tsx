import { Award, Heart, Users, Target, Map, Shield } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-gradient-to-br from-primary-50 to-beige-50 py-16">
        <div className="container-custom">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 text-center">About SaveYours</h1>
          <p className="text-xl text-gray-600 text-center max-w-3xl mx-auto">
            Founded with a mission to make life-saving education universally accessible, 
            empowering individuals to respond effectively in emergencies.
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Meet Our Founder</h2>
              <h3 className="text-xl font-semibold mb-4 text-primary-600">Meea Mosissa</h3>
              <p className="text-gray-600 mb-4">
                Meea Mosissa, founder of SaveYours, first received his NREMT certification in 2022, 
                and in doing so learned valuable techniques and knowledge that he feels everyone, 
                regardless of their background, should know.
              </p>
              <p className="text-gray-600 mb-4">
                His training not only deepened his understanding of emergency care, but also highlighted 
                the importance of early intervention in saving lives. This experience sparked his mission 
                to make life-saving education universally accessible, empowering individuals to respond 
                effectively in emergencies.
              </p>
              <div className="flex items-center space-x-2 text-primary-600">
                <Award className="w-5 h-5" />
                <span className="font-medium">Certified Red Cross Training Provider</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary-50 to-beige-100 rounded-lg p-8">
              <div className="bg-white rounded-lg p-6 shadow-lg">
                <blockquote className="text-lg italic text-gray-700">
                  Every person has the potential to save a life. My goal is to give them the 
                  knowledge and confidence to do so when it matters most.
                </blockquote>
                <p className="mt-4 text-right text-gray-600 font-medium">- Meea Mosissa</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-beige-50">
        <div className="container-custom">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Our Training Approach</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-10 h-10 text-primary-600" />
              </div>
              <h3 className="font-semibold text-lg mb-3">Blended Learning</h3>
              <p className="text-gray-600">
                Complete theoretical knowledge online at your own pace, then demonstrate 
                practical skills in person for the best learning experience.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-primary-600" />
              </div>
              <h3 className="font-semibold text-lg mb-3">Small Class Sizes</h3>
              <p className="text-gray-600">
                With a maximum of 12 students per session, you will receive personalized 
                attention and plenty of hands-on practice time.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-10 h-10 text-primary-600" />
              </div>
              <h3 className="font-semibold text-lg mb-3">Real-World Focus</h3>
              <p className="text-gray-600">
                Our training emphasizes practical, real-world scenarios to ensure you are 
                prepared for actual emergency situations.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container-custom">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Our Credentials</h2>
          
          <div className="max-w-3xl mx-auto">
            <div className="card p-8">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Award className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Certified Red Cross Training Provider</h3>
                    <p className="text-gray-600">
                      Authorized to provide official Red Cross certification courses.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Shield className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">OSHA Compliant Training</h3>
                    <p className="text-gray-600">
                      All courses meet OSHA requirements for workplace safety training.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Map className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">State & National Standards</h3>
                    <p className="text-gray-600">
                      Classes meet all national, state, and licensing requirements.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
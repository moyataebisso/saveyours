import Link from 'next/link';
import { Heart, Mail, MapPin, Phone } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container-custom py-12">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-2xl font-bold">SaveYours</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm">
              Empowering individuals with life-saving skills through professional CPR and First Aid training.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-gray-400">
              <li><Link href="/classes" className="hover:text-white transition-colors">Classes</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/policies" className="hover:text-white transition-colors">Policies</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Contact</h3>
            <ul className="space-y-2 text-gray-400">
              <li className="flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                <a href="mailto:info@saveyours.net" className="hover:text-white transition-colors">
                  info@saveyours.net
                </a>
              </li>
              <li className="flex items-start">
                <MapPin className="w-4 h-4 mr-2 mt-1" />
                <span>5450 W 41st St<br />Minneapolis, MN 55416</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Certifications</h3>
            <p className="text-gray-400 text-sm mb-2">
              Certified Red Cross Training Provider
            </p>
            <p className="text-gray-400 text-sm">
              Classes meet national, state, licensing and OSHA requirements
            </p>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
          <p>&copy; {new Date().getFullYear()} SaveYours LLC. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
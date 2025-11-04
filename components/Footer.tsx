import Link from 'next/link';
import Image from 'next/image';
import { Mail, MapPin, Phone } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-beige-50 text-gray-800">
      <div className="container-custom py-12">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="mb-4">
              <Image 
                src="/images/SaveYours.png" 
                alt="SaveYours Logo" 
                width={500} 
                height={200} 
                className="h-27 w-32"
              />
            </div>
            <p className="text-gray-600 text-sm">
              Empowering individuals with life-saving skills through professional CPR and First Aid training.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-gray-600">
              <li><Link href="/classes" className="hover:text-primary-600 transition-colors">Classes</Link></li>
              <li><Link href="/about" className="hover:text-primary-600 transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-primary-600 transition-colors">Contact</Link></li>
              <li><Link href="/policies" className="hover:text-primary-600 transition-colors">Policies</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Contact</h3>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                <a href="mailto:info@saveyours.net" className="hover:text-primary-600 transition-colors">
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
            <p className="text-gray-600 text-sm mb-2">
              Certified Red Cross Training Provider
            </p>
            <p className="text-gray-600 text-sm">
              Classes meet national, state, licensing and OSHA requirements
            </p>
          </div>
        </div>

        <div className="border-t border-beige-200 mt-8 pt-8 text-center text-gray-600 text-sm">
          <p>&copy; {new Date().getFullYear()} SaveYours LLC. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ShoppingCart, User, Shield, LogOut } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const loadCartCount = () => {
      const cart = localStorage.getItem('cart');
      if (cart) {
        const items = JSON.parse(cart);
        setCartCount(items.length);
      } else {
        setCartCount(0);
      }
    };
    
    const checkAuthStatus = () => {
      const adminAuth = localStorage.getItem('adminAuthenticated');
      const dashboardEmail = localStorage.getItem('dashboardEmail');
      setIsAdmin(adminAuth === 'true');
      setUserEmail(dashboardEmail);
    };

    loadCartCount();
    checkAuthStatus();
    
    window.addEventListener('storage', loadCartCount);
    window.addEventListener('storage', checkAuthStatus);
    
    return () => {
      window.removeEventListener('storage', loadCartCount);
      window.removeEventListener('storage', checkAuthStatus);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminAuthenticated');
    localStorage.removeItem('dashboardEmail');
    setIsAdmin(false);
    setUserEmail(null);
    router.push('/');
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/classes', label: 'Classes' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-white/95 backdrop-blur-md shadow-lg' 
        : 'bg-white/80 backdrop-blur-sm shadow-sm'
    }`}>
      <nav className="container-custom py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image 
              src="/images/logo.png" 
              alt="SaveYours Logo" 
              width={800} 
              height={320} 
              className="h-36 md:h-44 w-auto"
              priority
            />
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-medium transition-colors hover:text-primary-600 ${
                  pathname === link.href ? 'text-primary-600' : 'text-gray-700'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {(userEmail || isAdmin) && (
              <Link
                href="/dashboard"
                className={`font-medium transition-colors hover:text-primary-600 ${
                  pathname === '/dashboard' ? 'text-primary-600' : 'text-gray-700'
                }`}
              >
                My Classes
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                className={`font-medium transition-colors hover:text-primary-600 flex items-center gap-1 ${
                  pathname === '/admin' ? 'text-primary-600' : 'text-gray-700'
                }`}
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Link href="/cart" className="relative p-2 hover:bg-gray-100/80 rounded-lg transition-colors">
              <ShoppingCart className="w-6 h-6 text-gray-700" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
            
            {isAdmin || userEmail ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">
                  {isAdmin ? 'Admin' : userEmail}
                </span>
                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-gray-100/80 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            ) : (
              <Link 
                href="/login" 
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100/80 rounded-lg transition-colors"
              >
                <User className="w-5 h-5" />
                <span>Sign In</span>
              </Link>
            )}
            
            <Link href="/classes" className="btn btn-primary text-sm">
              Book Now
            </Link>
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 hover:bg-gray-100/80 rounded-lg transition-colors"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-gray-700" />
            ) : (
              <Menu className="w-6 h-6 text-gray-700" />
            )}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t pt-4">
            <div className="flex flex-col space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`font-medium py-2 px-4 rounded-lg transition-colors hover:bg-gray-100/80 ${
                    pathname === link.href ? 'text-primary-600 bg-primary-50/80' : 'text-gray-700'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              
              {(userEmail || isAdmin) && (
                <Link
                  href="/dashboard"
                  onClick={() => setIsMenuOpen(false)}
                  className={`font-medium py-2 px-4 rounded-lg transition-colors hover:bg-gray-100/80 ${
                    pathname === '/dashboard' ? 'text-primary-600 bg-primary-50/80' : 'text-gray-700'
                  }`}
                >
                  My Classes
                </Link>
              )}
              
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setIsMenuOpen(false)}
                  className={`font-medium py-2 px-4 rounded-lg transition-colors hover:bg-gray-100/80 flex items-center gap-2 ${
                    pathname === '/admin' ? 'text-primary-600 bg-primary-50/80' : 'text-gray-700'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Admin Dashboard
                </Link>
              )}
              
              <Link
                href="/cart"
                onClick={() => setIsMenuOpen(false)}
                className="font-medium py-2 px-4 rounded-lg transition-colors hover:bg-gray-100/80 text-gray-700 flex items-center justify-between"
              >
                Cart
                {cartCount > 0 && (
                  <span className="bg-primary-600 text-white text-xs px-2 py-1 rounded-full">
                    {cartCount}
                  </span>
                )}
              </Link>
              
              {isAdmin || userEmail ? (
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                  className="font-medium py-2 px-4 rounded-lg transition-colors hover:bg-gray-100/80 text-gray-700 flex items-center gap-2 text-left"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="font-medium py-2 px-4 rounded-lg transition-colors hover:bg-gray-100/80 text-gray-700 flex items-center gap-2"
                >
                  <User className="w-5 h-5" />
                  Sign In
                </Link>
              )}
              
              <Link
                href="/classes"
                onClick={() => setIsMenuOpen(false)}
                className="btn btn-primary text-center"
              >
                Book Now
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
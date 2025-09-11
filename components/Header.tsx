'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ShoppingCart, User, Heart } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const pathname = usePathname();

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
      }
    };
    loadCartCount();
    window.addEventListener('storage', loadCartCount);
    return () => window.removeEventListener('storage', loadCartCount);
  }, []);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/classes', label: 'Classes' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white shadow-lg' : 'bg-white/95 backdrop-blur-sm shadow-md'
    }`}>
      <nav className="container-custom py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="relative">
              <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center group-hover:bg-primary-700 transition-colors">
                <Heart className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-bold text-gray-900">Save</span>
              <span className="text-2xl font-bold text-primary-600">Yours</span>
            </div>
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
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Link href="/cart" className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ShoppingCart className="w-6 h-6 text-gray-700" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link href="/classes" className="btn btn-primary text-sm">
              Book Now
            </Link>
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
                  className={`font-medium py-2 px-4 rounded-lg transition-colors hover:bg-gray-100 ${
                    pathname === link.href ? 'text-primary-600 bg-primary-50' : 'text-gray-700'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/cart"
                onClick={() => setIsMenuOpen(false)}
                className="font-medium py-2 px-4 rounded-lg transition-colors hover:bg-gray-100 text-gray-700 flex items-center justify-between"
              >
                Cart
                {cartCount > 0 && (
                  <span className="bg-primary-600 text-white text-xs px-2 py-1 rounded-full">
                    {cartCount}
                  </span>
                )}
              </Link>
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
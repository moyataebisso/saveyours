'use client';

import { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = `mailto:info@saveyours.net?subject=Website Inquiry&body=${encodeURIComponent(message)}`;
    setMessage('');
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 animate-fade-in-up">
          <div className="bg-primary-600 text-white p-4 rounded-t-lg flex items-center justify-between">
            <h3 className="font-semibold">How can we help?</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-primary-700 p-1 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-4">
            <p className="text-sm text-gray-600 mb-3">
              Send us a message and we will get back to you soon!
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              className="input min-h-[100px] mb-3"
              required
            />
            <button type="submit" className="btn btn-primary w-full text-sm">
              <Send className="w-4 h-4 mr-2" />
              Send Message
            </button>
          </form>
        </div>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-primary-600 text-white rounded-full p-4 shadow-lg hover:bg-primary-700 hover:scale-110 transition-all duration-300 group"
        aria-label="Open chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastListeners: ((toast: Toast) => void)[] = [];

export const toast = {
  success: (message: string) => {
    const newToast: Toast = {
      id: Date.now().toString(),
      message,
      type: 'success',
    };
    toastListeners.forEach(listener => listener(newToast));
  },
  error: (message: string) => {
    const newToast: Toast = {
      id: Date.now().toString(),
      message,
      type: 'error',
    };
    toastListeners.forEach(listener => listener(newToast));
  },
  info: (message: string) => {
    const newToast: Toast = {
      id: Date.now().toString(),
      message,
      type: 'info',
    };
    toastListeners.forEach(listener => listener(newToast));
  },
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 5000);
    };

    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 flex items-center space-x-3 min-w-[300px] animate-fade-in-up"
        >
          {getIcon(toast.type)}
          <p className="flex-1 text-sm text-gray-700">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="hover:bg-gray-100 p-1 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      ))}
    </div>
  );
}
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { REFUND_POLICY } from '@/lib/refund-policy';

// Exit-intent modal for /cart. Fires once per tab session (sessionStorage)
// when the user shows signals of leaving. Never fires while enabled=false,
// which the parent sets during Stripe submit so we do not interrupt a live
// payment.
//
// Desktop signal: mouse leaves the viewport toward the top (clientY <= 20,
// no relatedTarget).
// Mobile signal: fast upward scroll (> 300px within a 250ms window). We
// deliberately DO NOT use an inactivity timer here — Stripe Elements are
// cross-origin iframes and their keydowns do not bubble to the document, so
// an inactivity timer would fire mid card-entry. A modal during card entry
// is worse than no modal.
// We deliberately do NOT intercept the back button.

const SESSION_STORAGE_KEY = 'cart_exit_intent_shown';
const SCROLL_WINDOW_MS = 250;
const SCROLL_UPWARD_THRESHOLD_PX = 300;
const MOUSE_TOP_THRESHOLD_PX = 20;

interface Props {
  enabled: boolean;
}

export default function ExitIntentModal({ enabled }: Props) {
  const [open, setOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const returnButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const alreadyTriggered = useRef(false);

  const trigger = useCallback(() => {
    if (alreadyTriggered.current) return;
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(SESSION_STORAGE_KEY) === '1') return;
    alreadyTriggered.current = true;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, '1');
    previousActiveElement.current = (document.activeElement as HTMLElement | null) ?? null;
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Restore focus to whatever was focused before the modal opened. Deferred
    // so the modal has finished unmounting when we call focus().
    const el = previousActiveElement.current;
    previousActiveElement.current = null;
    if (el && typeof el.focus === 'function') {
      setTimeout(() => el.focus(), 0);
    }
  }, []);

  // Register trigger listeners. Re-registers when enabled flips true, and
  // unregisters immediately when enabled flips false (mid-Stripe submit).
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(SESSION_STORAGE_KEY) === '1') return;

    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    const isFine = window.matchMedia('(pointer: fine)').matches;
    const cleanups: Array<() => void> = [];

    if (isFine) {
      const handleMouseOut = (e: MouseEvent) => {
        // Left the window entirely (or crossed into an iframe). The clientY
        // gate rejects mid-page iframe entries — real exit intent crosses
        // the top edge.
        if (e.relatedTarget) return;
        if (e.clientY > MOUSE_TOP_THRESHOLD_PX) return;
        trigger();
      };
      document.addEventListener('mouseout', handleMouseOut);
      cleanups.push(() => document.removeEventListener('mouseout', handleMouseOut));
    }

    if (isCoarse) {
      // Fast upward scroll: track scrollY samples in a sliding window; if
      // the user moved upward more than the threshold within the window, fire.
      let scrollSamples: Array<{ y: number; t: number }> = [];
      const handleScroll = () => {
        const now = Date.now();
        const y = window.scrollY;
        // If already near the top, no exit intent from an upward flick.
        if (y < 100) {
          scrollSamples = [];
          return;
        }
        scrollSamples.push({ y, t: now });
        scrollSamples = scrollSamples.filter((s) => now - s.t <= SCROLL_WINDOW_MS);
        if (scrollSamples.length < 2) return;
        const oldest = scrollSamples[0];
        const upwardMove = oldest.y - y;
        if (upwardMove > SCROLL_UPWARD_THRESHOLD_PX) {
          trigger();
        }
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      cleanups.push(() => window.removeEventListener('scroll', handleScroll));
    }

    return () => cleanups.forEach((c) => c());
  }, [enabled, trigger]);

  // Focus management + Escape + focus trap. Only wired while open.
  useEffect(() => {
    if (!open) return;
    const modal = modalRef.current;
    if (!modal) return;

    // Initial focus lands on the primary action so keyboard users can
    // press Enter to dismiss immediately.
    returnButtonRef.current?.focus();

    const getFocusable = (): HTMLElement[] =>
      Array.from(
        modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      );

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = getFocusable();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !modal.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !modal.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={close}
    >
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-intent-title"
        aria-describedby="exit-intent-desc"
        tabIndex={-1}
        className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 sm:p-8 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
        >
          <X className="w-5 h-5" />
        </button>

        <h2
          id="exit-intent-title"
          className="text-xl sm:text-2xl font-bold text-[#1B2A4A] mb-3 pr-8"
        >
          Save your seat before you go?
        </h2>

        <p id="exit-intent-desc" className="text-gray-700 mb-3">
          Your seat isn&rsquo;t reserved until you complete payment, and popular
          classes fill quickly.
        </p>

        <p className="text-sm text-gray-700 mb-4">
          {REFUND_POLICY.reassuranceSentence}
        </p>

        <p className="text-sm text-gray-600 mb-6">
          Questions?{' '}
          <a
            href={`mailto:${REFUND_POLICY.contactEmail}`}
            className="text-[#CC2936] underline hover:opacity-80"
          >
            {REFUND_POLICY.contactEmail}
          </a>
        </p>

        <button
          ref={returnButtonRef}
          type="button"
          onClick={close}
          className="w-full bg-[#CC2936] text-white font-semibold py-3 px-4 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#CC2936] focus:ring-offset-2"
        >
          Return to cart
        </button>
      </div>
    </div>
  );
}

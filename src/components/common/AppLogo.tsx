import { useId } from 'react';
import { cn } from '@/lib/utils';

/** App-Zeichen: Flamme (Gas) mit Blitz (Strom). Gleiches Motiv wie public/icon.svg. */
export function AppLogo({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={cn('size-8', className)}>
      <defs>
        <linearGradient id={`${id}-flame`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="128" fill="#111827" />
      <path
        fill={`url(#${id}-flame)`}
        d="M256 72c40 76 136 128 136 252 0 84-62 132-136 132s-136-48-136-132c0-74 44-118 72-162 8 44 30 70 56 80-12-62-8-118 8-170Z"
      />
      <path fill="#fbbf24" d="M280 212 204 334h52l-20 92 80-128h-52l16-86Z" />
    </svg>
  );
}

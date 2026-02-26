'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';

export function ConditionalHeader() {
  const pathname = usePathname();

  // Don't show header on login or welcome (first-run) pages
  if (pathname === '/login' || pathname === '/welcome') {
    return null;
  }

  return <Header />;
}

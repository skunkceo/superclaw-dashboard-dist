'use client';

import { usePathname } from 'next/navigation';
import ChatBubble from './ChatBubble';

export default function ChatBubbleWrapper() {
  const pathname = usePathname();
  
  if (!pathname || pathname === '/chat' || pathname === '/login' || pathname.startsWith('/chat/')) {
    return null;
  }
  
  return <ChatBubble />;
}

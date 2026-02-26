'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SessionsPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to agents page - sessions are now agent-focused
    router.replace('/agents');
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-zinc-400">Redirecting to agents...</div>
    </div>
  );
}
